import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, inArray, lt } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import { LIMITS, type BoardSettingsInput, type CreateBoardResponse } from '@retromode/shared'
import type { Db, DbOrTx } from '../db/client'
import {
  boards,
  groups,
  items,
  votes,
  type BoardRow,
  type GroupRow,
  type ItemRow,
} from '../db/schema'
import type { Changes } from './changes'
import { forbidden, locked, notFound } from './errors'
import { mutate, type Actor } from './mutate'

// 12 chars from a 62-char alphabet ≈ 71 bits: unguessable share links
const newSlug = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 12)

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

function defaultTitle(now = new Date()): string {
  return `Retro – ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// ---------------------------------------------------------------------------
// Boards

export async function createBoard(
  db: Db,
  input: { title?: string; clientId: string; voteLimit?: number },
): Promise<CreateBoardResponse> {
  const ownerKey = randomBytes(18).toString('base64url')
  const [board] = await db
    .insert(boards)
    .values({
      slug: newSlug(),
      title: input.title?.trim() || defaultTitle(),
      ownerClientId: input.clientId,
      ownerKeyHash: hashKey(ownerKey),
      voteLimit: input.voteLimit ?? LIMITS.defaultVoteLimit,
    })
    .returning({ slug: boards.slug })
  return { slug: board!.slug, ownerKey }
}

export async function findBoardBySlug(db: DbOrTx, slug: string): Promise<BoardRow | undefined> {
  const [board] = await db.select().from(boards).where(eq(boards.slug, slug))
  return board
}

export function isBoardOwner(board: BoardRow, clientId: string, ownerKey?: string): boolean {
  if (board.ownerClientId === clientId) return true
  if (!ownerKey) return false
  const a = Buffer.from(hashKey(ownerKey))
  const b = Buffer.from(board.ownerKeyHash)
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface BoardState {
  board: BoardRow
  groups: GroupRow[]
  items: ItemRow[]
  /** itemId → clientId → number of votes that client gave it (server-side only) */
  voters: Map<string, Map<string, number>>
}

async function loadVoters(
  db: DbOrTx,
  itemIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const voters = new Map<string, Map<string, number>>()
  if (itemIds.length === 0) return voters
  const rows = await db
    .select({ itemId: votes.itemId, clientId: votes.clientId, count: votes.count })
    .from(votes)
    .where(inArray(votes.itemId, itemIds))
  for (const row of rows) {
    let byClient = voters.get(row.itemId)
    if (!byClient) voters.set(row.itemId, (byClient = new Map()))
    byClient.set(row.clientId, row.count)
  }
  return voters
}

export async function loadBoardState(db: DbOrTx, boardId: string): Promise<BoardState> {
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId))
  if (!board) throw notFound('Board')
  const [groupRows, itemRows] = await Promise.all([
    db.select().from(groups).where(eq(groups.boardId, boardId)),
    db.select().from(items).where(eq(items.boardId, boardId)),
  ])
  return {
    board,
    groups: groupRows,
    items: itemRows,
    voters: await loadVoters(
      db,
      itemRows.map((i) => i.id),
    ),
  }
}

/** Current state of only the entities a mutation touched. */
export async function loadChangedState(
  db: DbOrTx,
  boardId: string,
  changes: Changes,
): Promise<BoardState> {
  const itemIds = [...changes.itemIds]
  const groupIds = [...changes.groupIds]
  const [boardRows, groupRows, itemRows] = await Promise.all([
    db.select().from(boards).where(eq(boards.id, boardId)),
    groupIds.length
      ? db
          .select()
          .from(groups)
          .where(and(eq(groups.boardId, boardId), inArray(groups.id, groupIds)))
      : Promise.resolve([]),
    itemIds.length
      ? db
          .select()
          .from(items)
          .where(and(eq(items.boardId, boardId), inArray(items.id, itemIds)))
      : Promise.resolve([]),
  ])
  if (!boardRows[0]) throw notFound('Board')
  return {
    board: boardRows[0],
    groups: groupRows,
    items: itemRows,
    voters: await loadVoters(
      db,
      itemRows.map((i) => i.id),
    ),
  }
}

// ---------------------------------------------------------------------------
// Settings

export function updateSettings(db: Db, actor: Actor, input: BoardSettingsInput): Promise<Changes> {
  return mutate(
    db,
    actor,
    async (tx, board, changes) => {
      if (!actor.isOwner) throw forbidden('Only the board owner can change settings')
      if (board.lockedAt && input.locked !== false) throw locked()
      const lockedAt =
        input.locked === undefined
          ? board.lockedAt
          : input.locked
            ? (board.lockedAt ?? new Date())
            : null
      await tx
        .update(boards)
        .set({
          title: input.title ?? board.title,
          voteLimit: input.voteLimit ?? board.voteLimit,
          lockedAt,
        })
        .where(eq(boards.id, board.id))
      changes.boardChanged()
    },
    { allowWhenLocked: true },
  )
}

// ---------------------------------------------------------------------------
// Maintenance

/**
 * Owner only: deletes the board for good. Groups, items and votes go with it
 * (ON DELETE CASCADE), and nothing about the board is kept or logged.
 */
export async function nukeBoard(db: Db, actor: Actor): Promise<void> {
  if (!actor.isOwner) throw forbidden('Only the board owner can nuke the board')
  const deleted = await db
    .delete(boards)
    .where(eq(boards.id, actor.boardId))
    .returning({ id: boards.id })
  if (deleted.length === 0) throw notFound('Board')
}

export async function deleteInactiveBoards(db: Db, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(boards)
    .where(lt(boards.lastActivityAt, cutoff))
    .returning({ id: boards.id })
  return deleted.length
}
