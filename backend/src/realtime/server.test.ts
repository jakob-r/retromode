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
    expect((await emit(bob, 'vote:toggle', { itemId })).ok).toBe(true)
    expect((await voted).items?.[0]).toMatchObject({ votes: 1, votedByMe: false })

    // Bob can't change settings, but can claim ownership with the owner key
    const denied = await emit(bob, 'board:settings', { voteLimit: 7 })
    expect(denied).toMatchObject({ ok: false, error: 'FORBIDDEN' })
    const rejoin = await emit<BoardSnapshot>(bob, 'board:join', { slug, ownerKey })
    expect(rejoin.ok && rejoin.data.board.isOwner).toBe(true)
    const locked = nextPatch(alice)
    expect((await emit(bob, 'board:settings', { locked: true })).ok).toBe(true)
    expect((await locked).board).toMatchObject({ locked: true, isOwner: true })
    expect(await emit(alice, 'vote:toggle', { itemId })).toMatchObject({
      ok: false,
      error: 'LOCKED',
    })
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
