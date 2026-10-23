import type { FastifyBaseLogger } from 'fastify'
import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import type { z } from 'zod'
import {
  boardJoinSchema,
  boardNukeSchema,
  boardReadySchema,
  boardSettingsSchema,
  boardTimerSchema,
  groupMergeSchema,
  groupMoveSchema,
  groupRenameSchema,
  groupUngroupSchema,
  idSchema,
  itemCreateSchema,
  itemDeleteSchema,
  itemLinkSchema,
  itemMoveSchema,
  itemUpdateSchema,
  voteSchema,
  type Ack,
  type BoardSnapshot,
  type ClientToServerEvents,
  type MutationEvent,
  type ServerToClientEvents,
} from '@retromode/shared'
import type { Db } from '../db/client'
import * as domain from '../domain'
import type { Changes } from '../domain/changes'
import { DomainError, invalid, notFound, notJoined, rateLimited } from '../domain/errors'
import { patchFor, snapshotFor } from '../domain/public'
import { TokenBucket } from './rate-limit'

interface SocketData {
  clientId: string
  boardId?: string
  isOwner: boolean
  bucket: TokenBucket
}

type RetroServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>
type RetroSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>

const room = (boardId: string) => `board:${boardId}`

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw invalid('Invalid input')
  return parsed.data
}

type Mutation = (db: Db, actor: domain.Actor, raw: unknown) => Promise<Changes>

/** Validates the input with `schema` before running the mutation. */
const mutation =
  <S extends z.ZodType>(
    schema: S,
    run: (db: Db, actor: domain.Actor, input: z.infer<S>) => Promise<Changes>,
  ): Mutation =>
  (db, actor, raw) =>
    run(db, actor, parse(schema, raw))

const mutations: Record<MutationEvent, Mutation> = {
  'board:settings': mutation(boardSettingsSchema, domain.updateSettings),
  'board:timer': mutation(boardTimerSchema, domain.setTimer),
  'board:ready': mutation(boardReadySchema, domain.setReady),
  'item:create': mutation(itemCreateSchema, domain.createItem),
  'item:update': mutation(itemUpdateSchema, domain.updateItem),
  'item:delete': mutation(itemDeleteSchema, domain.deleteItem),
  'item:move': mutation(itemMoveSchema, domain.moveItem),
  'item:link': mutation(itemLinkSchema, domain.linkItem),
  'group:merge': mutation(groupMergeSchema, domain.merge),
  'group:ungroup': mutation(groupUngroupSchema, domain.ungroup),
  'group:rename': mutation(groupRenameSchema, domain.renameGroup),
  'group:move': mutation(groupMoveSchema, domain.moveGroup),
  'vote:add': mutation(voteSchema, domain.addVote),
  'vote:remove': mutation(voteSchema, domain.removeVote),
}

function fail(error: unknown, log: FastifyBaseLogger): Ack<never> {
  if (error instanceof DomainError) return { ok: false, error: error.code, message: error.message }
  log.error({ err: error }, 'socket handler failed')
  return { ok: false, error: 'INTERNAL', message: 'Something went wrong' }
}

export function createRealtimeServer(
  httpServer: HttpServer,
  db: Db,
  log: FastifyBaseLogger,
): RetroServer {
  const io: RetroServer = new Server(httpServer, {
    serveClient: false,
    // Everything is same-origin (Vite proxies in dev, Fastify serves the app in production).
    cors: { origin: false },
  })

  // Broadcasts run one at a time per board and read fresh state, so patches
  // never arrive at clients in an older-than-previous order.
  const queues = new Map<string, Promise<void>>()
  function broadcast(boardId: string, changes: Changes): Promise<void> {
    const run = async () => {
      const state = await domain.loadChangedState(db, boardId, changes)
      for (const s of socketsOn(boardId)) s.emit('board:patch', patchFor(state, changes, s.data))
    }
    const next = (queues.get(boardId) ?? Promise.resolve())
      .then(run)
      .catch((err: unknown) => log.error({ err }, 'broadcast failed'))
    queues.set(boardId, next)
    void next.then(() => {
      if (queues.get(boardId) === next) queues.delete(boardId)
    })
    return next
  }

  /** One process serves everything, so the in-memory adapter knows every socket. */
  function socketsOn(boardId: string): RetroSocket[] {
    const ids = io.sockets.adapter.rooms.get(room(boardId)) ?? []
    return [...ids].flatMap((id) => io.sockets.sockets.get(id) ?? [])
  }

  const onlineClients = (boardId: string) => new Set(socketsOn(boardId).map((s) => s.data.clientId))

  /** The joined, not rate-limited actor behind a socket's next change. */
  function actorOf(socket: RetroSocket): domain.Actor {
    const { boardId, clientId, isOwner, bucket } = socket.data
    if (!boardId) throw notJoined()
    if (!bucket.take()) throw rateLimited()
    return { boardId, clientId, isOwner }
  }

  /**
   * Tells everyone who's here and how many of them are done with the timer.
   * Once all of them are, the timer stops early and it's time's up for everyone.
   */
  async function announcePresence(boardId: string) {
    try {
      const online = onlineClients(boardId)
      const { ready, finished } = await domain.settleReady(db, boardId, online)
      if (finished) {
        await broadcast(boardId, finished)
        io.to(room(boardId)).emit('board:timeup')
      }
      io.to(room(boardId)).emit('presence', { online: online.size, ready })
    } catch (err) {
      log.error({ err }, 'presence failed')
    }
  }

  async function snapshot(socket: RetroSocket): Promise<BoardSnapshot> {
    const boardId = socket.data.boardId
    if (!boardId) throw notJoined()
    const state = await domain.loadBoardState(db, boardId)
    const online = onlineClients(boardId)
    return snapshotFor(state, socket.data, online.size, domain.readyAmong(state.board, online))
  }

  io.use((socket, next) => {
    const parsed = idSchema.safeParse((socket.handshake.auth as { clientId?: unknown }).clientId)
    if (!parsed.success) return next(new Error('INVALID_CLIENT'))
    socket.data = { clientId: parsed.data, isOwner: false, bucket: new TokenBucket() }
    next()
  })

  io.on('connection', (socket: RetroSocket) => {
    socket.on('board:join', async (raw, ack) => {
      try {
        const input = parse(boardJoinSchema, raw)
        const board = await domain.findBoardBySlug(db, input.slug)
        if (!board) throw notFound('Board')
        const previous = socket.data.boardId
        if (previous && previous !== board.id) {
          await socket.leave(room(previous))
          void announcePresence(previous)
        }
        socket.data.boardId = board.id
        socket.data.isOwner = domain.isBoardOwner(board, socket.data.clientId, input.ownerKey)
        await socket.join(room(board.id))
        ack({ ok: true, data: await snapshot(socket) })
        void announcePresence(board.id)
      } catch (error) {
        ack(fail(error, log))
      }
    })

    socket.on('board:sync', async (_raw, ack) => {
      try {
        ack({ ok: true, data: await snapshot(socket) })
      } catch (error) {
        ack(fail(error, log))
      }
    })

    socket.on('board:nuke', async (raw, ack) => {
      if (typeof ack !== 'function') return
      try {
        const actor = actorOf(socket)
        parse(boardNukeSchema, raw)
        await domain.nukeBoard(db, actor)
        const { boardId } = actor
        ack({ ok: true, data: null })
        // Tell everyone else, then forget who was here
        socket.to(room(boardId)).emit('board:nuked')
        for (const s of socketsOn(boardId)) {
          s.data.boardId = undefined
          s.data.isOwner = false
          void s.leave(room(boardId))
        }
      } catch (error) {
        ack(fail(error, log))
      }
    })

    for (const [event, run] of Object.entries(mutations)) {
      socket.on(event as MutationEvent, async (raw: unknown, ack: (res: Ack) => void) => {
        if (typeof ack !== 'function') return
        try {
          const actor = actorOf(socket)
          const { boardId } = actor
          const changes = await run(db, actor, raw)
          ack({ ok: true, data: null })
          if (!changes.isEmpty) await broadcast(boardId, changes)
          if (event === 'board:ready' || event === 'board:timer') await announcePresence(boardId)
        } catch (error) {
          ack(fail(error, log))
        }
      })
    }

    socket.on('disconnect', () => {
      if (socket.data.boardId) void announcePresence(socket.data.boardId)
    })
  })

  return io
}
