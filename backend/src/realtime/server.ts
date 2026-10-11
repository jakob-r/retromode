import type { FastifyBaseLogger } from 'fastify'
import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import type { z } from 'zod'
import {
  boardJoinSchema,
  boardSettingsSchema,
  groupMergeSchema,
  groupMoveSchema,
  groupUngroupSchema,
  groupUpdateSchema,
  idSchema,
  itemCreateSchema,
  itemDeleteSchema,
  itemLinkSchema,
  itemMoveSchema,
  itemUpdateSchema,
  voteToggleSchema,
  type Ack,
  type BoardSnapshot,
  type ClientToServerEvents,
  type MutationEvent,
  type ServerToClientEvents,
} from '@retromode/shared'
import type { Db } from '../db/client'
import * as boards from '../domain/boards'
import type { Changes } from '../domain/changes'
import { DomainError } from '../domain/errors'
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

type Mutation<S extends z.ZodType> = (
  db: Db,
  actor: boards.Actor,
  input: z.infer<S>,
) => Promise<Changes>

const mutations: { [E in MutationEvent]: [z.ZodType, Mutation<z.ZodType>] } = {
  'board:settings': [boardSettingsSchema, boards.updateSettings as Mutation<z.ZodType>],
  'item:create': [itemCreateSchema, boards.createItem as Mutation<z.ZodType>],
  'item:update': [itemUpdateSchema, boards.updateItem as Mutation<z.ZodType>],
  'item:delete': [itemDeleteSchema, boards.deleteItem as Mutation<z.ZodType>],
  'item:move': [itemMoveSchema, boards.moveItem as Mutation<z.ZodType>],
  'item:link': [itemLinkSchema, boards.linkItem as Mutation<z.ZodType>],
  'group:merge': [groupMergeSchema, boards.mergeEntries as Mutation<z.ZodType>],
  'group:ungroup': [groupUngroupSchema, boards.ungroup as Mutation<z.ZodType>],
  'group:update': [groupUpdateSchema, boards.updateGroup as Mutation<z.ZodType>],
  'group:move': [groupMoveSchema, boards.moveGroup as Mutation<z.ZodType>],
  'vote:toggle': [voteToggleSchema, boards.toggleVote as Mutation<z.ZodType>],
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
      const state = await boards.loadChangedState(db, boardId, changes)
      const sockets = await io.in(room(boardId)).fetchSockets()
      for (const s of sockets) s.emit('board:patch', patchFor(state, changes, s.data))
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

  async function onlineCount(boardId: string): Promise<number> {
    const sockets = await io.in(room(boardId)).fetchSockets()
    return new Set(sockets.map((s) => s.data.clientId)).size
  }

  async function announcePresence(boardId: string) {
    io.to(room(boardId)).emit('presence', { online: await onlineCount(boardId) })
  }

  async function snapshot(socket: RetroSocket): Promise<BoardSnapshot> {
    const boardId = socket.data.boardId
    if (!boardId) throw new DomainError('NOT_JOINED', 'Join a board first')
    const state = await boards.loadBoardState(db, boardId)
    return snapshotFor(state, socket.data, await onlineCount(boardId))
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
        const parsed = boardJoinSchema.safeParse(raw)
        if (!parsed.success) throw invalidInput()
        const input = parsed.data
        const board = await boards.findBoardBySlug(db, input.slug)
        if (!board) throw new DomainError('NOT_FOUND', 'Board not found')
        const previous = socket.data.boardId
        if (previous && previous !== board.id) {
          await socket.leave(room(previous))
          void announcePresence(previous)
        }
        socket.data.boardId = board.id
        socket.data.isOwner = boards.isBoardOwner(board, socket.data.clientId, input.ownerKey)
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

    for (const [event, [schema, run]] of Object.entries(mutations)) {
      socket.on(event as MutationEvent, async (raw: unknown, ack: (res: Ack) => void) => {
        if (typeof ack !== 'function') return
        try {
          const boardId = socket.data.boardId
          if (!boardId) throw new DomainError('NOT_JOINED', 'Join a board first')
          if (!socket.data.bucket.take()) {
            throw new DomainError('RATE_LIMITED', 'Slow down a little')
          }
          const parsed = schema.safeParse(raw)
          if (!parsed.success) throw invalidInput()
          const changes = await run(db, { boardId, ...socket.data }, parsed.data)
          ack({ ok: true, data: null })
          if (!changes.isEmpty) await broadcast(boardId, changes)
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

const invalidInput = () => new DomainError('INVALID', 'Invalid input')
