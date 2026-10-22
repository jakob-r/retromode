import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as connect, type Socket } from 'socket.io-client'
import type {
  Ack,
  BoardPatch,
  BoardSnapshot,
  ClientToServerEvents,
  CreateBoardResponse,
  ServerToClientEvents,
} from '@retromode/shared'
import { buildApp, type App } from '../app'
import { loadConfig } from '../config'
import { db, pool } from '../test/helpers'

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let app: App
let url: string
const sockets: ClientSocket[] = []

beforeAll(async () => {
  app = await buildApp({ ...loadConfig(), LOG_LEVEL: 'silent', STATIC_DIR: '/nonexistent' }, db)
  await app.app.listen({ port: 0, host: '127.0.0.1' })
  url = `http://127.0.0.1:${(app.app.server.address() as AddressInfo).port}`
})

afterAll(async () => {
  for (const s of sockets) s.disconnect()
  await app.app.close()
  await pool.end()
})

function client(clientId = randomUUID()): ClientSocket {
  const socket: ClientSocket = connect(url, { auth: { clientId }, transports: ['websocket'] })
  sockets.push(socket)
  return socket
}

function emit<T>(
  socket: ClientSocket,
  event: keyof ClientToServerEvents,
  input: unknown,
): Promise<Ack<T>> {
  return new Promise((resolve) => {
    ;(socket.emit as (e: string, i: unknown, cb: (r: Ack<T>) => void) => void)(
      event,
      input,
      resolve,
    )
  })
}

function nextPatch(socket: ClientSocket): Promise<BoardPatch> {
  return new Promise((resolve) => socket.once('board:patch', resolve))
}

async function createBoard(clientId: string): Promise<CreateBoardResponse> {
  const res = await app.app.inject({ method: 'POST', url: '/api/boards', payload: { clientId } })
  expect(res.statusCode).toBe(201)
  return res.json()
}

describe('realtime', () => {
  it('rejects connections without a valid clientId', async () => {
    const socket = connect(url, { auth: { clientId: 'nope' }, transports: ['websocket'] })
    const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve))
    expect(error.message).toBe('INVALID_CLIENT')
    socket.disconnect()
  })

  it('syncs items and votes to all participants with personalized flags', async () => {
    const ownerId = randomUUID()
    const { slug, ownerKey } = await createBoard(ownerId)
    const alice = client(ownerId)
    const bob = client()

    const joinA = await emit<BoardSnapshot>(alice, 'board:join', { slug })
    const joinB = await emit<BoardSnapshot>(bob, 'board:join', { slug })
    expect(joinA.ok && joinA.data.board.isOwner).toBe(true)
    expect(joinB.ok && joinB.data.board.isOwner).toBe(false)

    const itemId = randomUUID()
    const bobSees = nextPatch(bob)
    const aliceSees = nextPatch(alice)
    const created = await emit(alice, 'item:create', {
      id: itemId,
      column: 'well',
      text: 'Great teamwork',
      anonymous: true,
    })
    expect(created.ok).toBe(true)
    const [forBob, forAlice] = await Promise.all([bobSees, aliceSees])
    expect(forBob.items?.[0]).toMatchObject({ id: itemId, nickname: null, mine: false })
    expect(forAlice.items?.[0]).toMatchObject({ id: itemId, mine: true })
    expect(JSON.stringify(forBob)).not.toContain(ownerId)

    const voted = nextPatch(alice)
    expect((await emit(bob, 'vote:add', { itemId })).ok).toBe(true)
    expect((await voted).items?.[0]).toMatchObject({ votes: 1, myVotes: 0 })

    // Bob can't change settings, but can claim ownership with the owner key
    const denied = await emit(bob, 'board:settings', { voteLimit: 7 })
    expect(denied).toMatchObject({ ok: false, error: 'FORBIDDEN' })
    const rejoin = await emit<BoardSnapshot>(bob, 'board:join', { slug, ownerKey })
    expect(rejoin.ok && rejoin.data.board.isOwner).toBe(true)
    const locked = nextPatch(alice)
    expect((await emit(bob, 'board:settings', { locked: true })).ok).toBe(true)
    expect((await locked).board).toMatchObject({ locked: true, isOwner: true })
    expect(await emit(alice, 'vote:add', { itemId })).toMatchObject({
      ok: false,
      error: 'LOCKED',
    })
  })

  it('lets the owner nuke the board and kicks everyone out', async () => {
    const ownerId = randomUUID()
    const { slug } = await createBoard(ownerId)
    const alice = client(ownerId)
    const bob = client()
    await emit(alice, 'board:join', { slug })
    await emit(bob, 'board:join', { slug })

    expect(await emit(bob, 'board:nuke', { confirm: 'NUKE' })).toMatchObject({
      ok: false,
      error: 'FORBIDDEN',
    })
    expect(await emit(alice, 'board:nuke', { confirm: 'nuke' })).toMatchObject({
      ok: false,
      error: 'INVALID',
    })

    const bobKicked = new Promise<void>((resolve) => bob.once('board:nuked', resolve))
    expect((await emit(alice, 'board:nuke', { confirm: 'NUKE' })).ok).toBe(true)
    await bobKicked
    expect(await emit(bob, 'board:sync', {})).toMatchObject({ ok: false, error: 'NOT_JOINED' })
    expect(await emit(bob, 'board:join', { slug })).toMatchObject({
      ok: false,
      error: 'NOT_FOUND',
    })
  })

  it('stops the timer for everyone once all participants are ready', async () => {
    const { slug } = await createBoard(randomUUID())
    const alice = client()
    const bob = client()
    await emit(alice, 'board:join', { slug })
    await emit(bob, 'board:join', { slug })
    await emit(alice, 'board:timer', { seconds: 300 })

    const halfReady = new Promise<{ ready: number }>((resolve) =>
      bob.on('presence', (p) => p.ready === 1 && resolve(p)),
    )
    expect((await emit(alice, 'board:ready', { ready: true })).ok).toBe(true)
    expect(await halfReady).toEqual({ online: 2, ready: 1 })

    const timeUp = new Promise<void>((resolve) => alice.once('board:timeup', resolve))
    expect((await emit(bob, 'board:ready', { ready: true })).ok).toBe(true)
    await timeUp
    const sync = await emit<BoardSnapshot>(alice, 'board:sync', {})
    expect(sync.ok && sync.data.board.timer).toBeNull()
  })

  it('validates input and requires joining first', async () => {
    const { slug } = await createBoard(randomUUID())
    const socket = client()
    expect(await emit(socket, 'item:create', {})).toMatchObject({ ok: false, error: 'NOT_JOINED' })
    expect(await emit(socket, 'board:join', { slug: 'doesnotexist' })).toMatchObject({
      ok: false,
      error: 'NOT_FOUND',
    })
    await emit(socket, 'board:join', { slug })
    expect(await emit(socket, 'item:create', { column: 'nope' })).toMatchObject({
      ok: false,
      error: 'INVALID',
    })
  })
})
