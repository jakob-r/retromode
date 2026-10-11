import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, inArray, isNull, lt, sql, sum } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import {
  positionAfter,
  positionsBetween,
  sortPositioned,
  type BoardSettingsInput,
  type BoardTimerInput,
  type ColumnKey,
  type CreateBoardResponse,
  type EntryRef,
  type GroupMergeInput,
  type GroupMoveInput,
  type GroupUngroupInput,
  type GroupUpdateInput,
  type ItemCreateInput,
  type ItemDeleteInput,
  type ItemLinkInput,
  type ItemMoveInput,
  type ItemUpdateInput,
  type Positioned,
  type VoteInput,
} from '@retromode/shared'
import type { Db, DbOrTx, Tx } from '../db/client'
import {
  boards,
  groups,
  items,
  votes,
  type BoardRow,
  type GroupRow,
  type ItemRow,
} from '../db/schema'
import { Changes } from './changes'
import { DomainError, forbidden, invalid, notFound } from './errors'

/** The identity of whoever performs an action on a joined board. */
export interface Actor {
  boardId: string
  clientId: string
  isOwner: boolean
}

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
  input: { title?: string; clientId: string },
): Promise<CreateBoardResponse> {
  const ownerKey = randomBytes(18).toString('base64url')
  const [board] = await db
    .insert(boards)
    .values({
      slug: newSlug(),
      title: input.title?.trim() || defaultTitle(),
      ownerClientId: input.clientId,
      ownerKeyHash: hashKey(ownerKey),
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
// Mutation plumbing

/**
 * Runs a mutation in a transaction holding a row lock on the board, so all
 * writes to one board are serialized (positions, vote budgets, grouping).
 */
async function mutate(
  db: Db,
  actor: Actor,
  fn: (tx: Tx, board: BoardRow, changes: Changes) => Promise<void>,
  { allowWhenLocked = false } = {},
): Promise<Changes> {
  return db.transaction(async (tx) => {
    const [board] = await tx.select().from(boards).where(eq(boards.id, actor.boardId)).for('update')
    if (!board) throw notFound('Board')
    if (board.lockedAt && !allowWhenLocked) {
      throw new DomainError('LOCKED', 'This board is locked')
    }
    const changes = new Changes()
    await fn(tx, board, changes)
    if (!changes.isEmpty) {
      await tx.update(boards).set({ lastActivityAt: new Date() }).where(eq(boards.id, board.id))
    }
    return changes
  })
}

async function getItem(tx: Tx, boardId: string, itemId: string): Promise<ItemRow> {
  const [item] = await tx
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.boardId, boardId)))
  if (!item) throw notFound('Item')
  return item
}

async function getGroup(tx: Tx, boardId: string, groupId: string): Promise<GroupRow> {
  const [group] = await tx
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.boardId, boardId)))
  if (!group) throw notFound('Group')
  return group
}

/** Top-level entries of a column: groups and items that are not in a group. */
async function columnEntries(tx: Tx, boardId: string, column: ColumnKey): Promise<Positioned[]> {
  const [groupRows, itemRows] = await Promise.all([
    tx
      .select({ id: groups.id, position: groups.position })
      .from(groups)
      .where(and(eq(groups.boardId, boardId), eq(groups.column, column))),
    tx
      .select({ id: items.id, position: items.position })
      .from(items)
      .where(and(eq(items.boardId, boardId), eq(items.column, column), isNull(items.groupId))),
  ])
  return [...groupRows, ...itemRows]
}

async function groupItems(tx: Tx, groupId: string): Promise<ItemRow[]> {
  const rows = await tx.select().from(items).where(eq(items.groupId, groupId))
  return sortPositioned(rows)
}

const without = (entries: Positioned[], id: string) => entries.filter((e) => e.id !== id)

/** A group with fewer than two items is dissolved; a remaining item takes the group's place. */
async function dissolveIfSmall(tx: Tx, groupId: string, changes: Changes): Promise<void> {
  const [group] = await tx.select().from(groups).where(eq(groups.id, groupId))
  if (!group) return
  const rest = await groupItems(tx, groupId)
  if (rest.length >= 2) return
  const last = rest[0]
  if (last) {
    await tx
      .update(items)
      .set({ groupId: null, column: group.column, position: group.position })
      .where(eq(items.id, last.id))
    changes.item(last.id)
  }
  await retargetLinks(tx, { type: 'group', id: groupId }, last?.id ?? null, changes)
  await tx.delete(groups).where(eq(groups.id, groupId))
  changes.deleteGroup(groupId)
}

// ---------------------------------------------------------------------------
// Links: an action item hangs on a string from the "To improve" entry it addresses

const LINK_SOURCE: ColumnKey = 'actions'
const LINK_TARGET: ColumnKey = 'improve'

/** Validates a link target and returns the item columns that store it. */
async function linkColumns(tx: Tx, boardId: string, target: EntryRef | null) {
  if (!target) return { linkedItemId: null, linkedGroupId: null }
  const { column } =
    target.type === 'group'
      ? await getGroup(tx, boardId, target.id)
      : await getItem(tx, boardId, target.id)
  if (column !== LINK_TARGET) throw invalid('Action items can only be tied to things to improve')
  return target.type === 'group'
    ? { linkedItemId: null, linkedGroupId: target.id }
    : { linkedItemId: target.id, linkedGroupId: null }
}

/**
 * Before an entry disappears, re-ties the strings attached to it to `itemId`
 * (e.g. the item left over from a dissolved group), or cuts them.
 */
async function retargetLinks(tx: Tx, from: EntryRef, itemId: string | null, changes: Changes) {
  const column = from.type === 'group' ? items.linkedGroupId : items.linkedItemId
  const rows = await tx
    .update(items)
    .set({ linkedItemId: itemId, linkedGroupId: null })
    .where(eq(column, from.id))
    .returning({ id: items.id })
  for (const row of rows) changes.item(row.id)
}

// ---------------------------------------------------------------------------
// Items

export function createItem(db: Db, actor: Actor, input: ItemCreateInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    if (input.link && input.column !== LINK_SOURCE) throw invalid('Only action items can be tied')
    const link = await linkColumns(tx, board.id, input.link ?? null)
    // Newest items go to the top of the column, right below the input.
    const position = positionAfter(await columnEntries(tx, board.id, input.column), null)
    const inserted = await tx
      .insert(items)
      .values({
        id: input.id,
        boardId: board.id,
        column: input.column,
        position,
        text: input.text,
        authorClientId: actor.clientId,
        authorNickname: input.anonymous ? null : (input.nickname ?? null),
        ...link,
      })
      .onConflictDoNothing()
      .returning({ id: items.id })
    if (inserted.length === 0) throw invalid('Item id already exists')
    changes.item(input.id)
  })
}

export function updateItem(db: Db, actor: Actor, input: ItemUpdateInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const item = await getItem(tx, board.id, input.itemId)
    if (item.authorClientId !== actor.clientId) throw forbidden('You can only edit your own items')

    let authorNickname = item.authorNickname
    if (input.anonymous === true) authorNickname = null
    else if (input.anonymous === false) authorNickname = input.nickname ?? item.authorNickname
    else if (input.nickname !== undefined && item.authorNickname !== null)
      authorNickname = input.nickname

    await tx
      .update(items)
      .set({ text: input.text ?? item.text, authorNickname, updatedAt: new Date() })
      .where(eq(items.id, item.id))
    changes.item(item.id)
  })
}

export function deleteItem(db: Db, actor: Actor, input: ItemDeleteInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const item = await getItem(tx, board.id, input.itemId)
    if (item.authorClientId !== actor.clientId && !actor.isOwner) {
      throw forbidden('You can only delete your own items')
    }
    await retargetLinks(tx, { type: 'item', id: item.id }, null, changes)
    await tx.delete(items).where(eq(items.id, item.id))
    changes.deleteItem(item.id)
    if (item.groupId) await dissolveIfSmall(tx, item.groupId, changes)
  })
}

export function moveItem(db: Db, actor: Actor, input: ItemMoveInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const item = await getItem(tx, board.id, input.itemId)
    let column = input.column
    let position: string
    if (input.groupId) {
      const group = await getGroup(tx, board.id, input.groupId)
      column = group.column
      position = positionAfter(without(await groupItems(tx, group.id), item.id), input.afterId)
      changes.group(group.id)
    } else {
      position = positionAfter(
        without(await columnEntries(tx, board.id, column), item.id),
        input.afterId,
      )
    }
    await tx
      .update(items)
      .set({ column, position, groupId: input.groupId })
      .where(eq(items.id, item.id))
    changes.item(item.id)
    if (item.groupId && item.groupId !== input.groupId) {
      await dissolveIfSmall(tx, item.groupId, changes)
    }
  })
}

export function linkItem(db: Db, actor: Actor, input: ItemLinkInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const item = await getItem(tx, board.id, input.itemId)
    if (input.target && item.column !== LINK_SOURCE) throw invalid('Only action items can be tied')
    await tx
      .update(items)
      .set(await linkColumns(tx, board.id, input.target))
      .where(eq(items.id, item.id))
    changes.item(item.id)
  })
}

// ---------------------------------------------------------------------------
// Groups

/** A target item that sits in a group stands for its group. */
async function resolveTarget(tx: Tx, boardId: string, ref: EntryRef) {
  if (ref.type === 'group') return { group: await getGroup(tx, boardId, ref.id) }
  const item = await getItem(tx, boardId, ref.id)
  if (item.groupId) return { group: await getGroup(tx, boardId, item.groupId) }
  return { item }
}

export function mergeEntries(db: Db, actor: Actor, input: GroupMergeInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    if (input.source.id === input.target.id) throw invalid('Cannot merge an entry with itself')

    const sourceGroup =
      input.source.type === 'group' ? await getGroup(tx, board.id, input.source.id) : null
    const sourceItems = sourceGroup
      ? await groupItems(tx, sourceGroup.id)
      : [await getItem(tx, board.id, input.source.id)]
    const target = await resolveTarget(tx, board.id, input.target)

    if (target.group && sourceGroup?.id === target.group.id) return
    if (target.group && sourceItems.every((i) => i.groupId === target.group.id)) return

    let group: GroupRow
    let existing: ItemRow[]
    if (target.group) {
      group = target.group
      existing = await groupItems(tx, group.id)
    } else {
      // Standalone item onto standalone item: a new group takes the target's place.
      const targetItem = target.item
      const inserted = await tx
        .insert(groups)
        .values({
          id: input.newGroupId,
          boardId: board.id,
          column: targetItem.column,
          position: targetItem.position,
          title: sourceGroup?.title ?? null,
        })
        .onConflictDoNothing()
        .returning()
      if (!inserted[0]) throw invalid('Group id already exists')
      group = inserted[0]
      const [first] = positionsBetween(null, null, 1)
      await tx
        .update(items)
        .set({ groupId: group.id, position: first! })
        .where(eq(items.id, targetItem.id))
      existing = [{ ...targetItem, groupId: group.id, position: first! }]
      changes.item(targetItem.id)
    }
    changes.group(group.id)

    const moving = sourceItems.filter((i) => i.groupId !== group.id)
    const keys = positionsBetween(
      sortPositioned(existing).at(-1)?.position ?? null,
      null,
      moving.length,
    )
    const oldGroupIds = new Set<string>()
    for (const [index, item] of moving.entries()) {
      await tx
        .update(items)
        .set({ groupId: group.id, column: group.column, position: keys[index]! })
        .where(eq(items.id, item.id))
      changes.item(item.id)
      if (item.groupId) oldGroupIds.add(item.groupId)
    }
    for (const oldGroupId of oldGroupIds) await dissolveIfSmall(tx, oldGroupId, changes)
  })
}

export function ungroup(db: Db, actor: Actor, input: GroupUngroupInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const group = await getGroup(tx, board.id, input.groupId)
    const members = await groupItems(tx, group.id)
    const entries = sortPositioned(await columnEntries(tx, board.id, group.column))
    const next = entries[entries.findIndex((e) => e.id === group.id) + 1]?.position ?? null
    const keys = positionsBetween(group.position, next, members.length)
    for (const [index, item] of members.entries()) {
      await tx
        .update(items)
        .set({ groupId: null, position: keys[index]! })
        .where(eq(items.id, item.id))
      changes.item(item.id)
    }
    await retargetLinks(tx, { type: 'group', id: group.id }, members[0]?.id ?? null, changes)
    await tx.delete(groups).where(eq(groups.id, group.id))
    changes.deleteGroup(group.id)
  })
}

export function updateGroup(db: Db, actor: Actor, input: GroupUpdateInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const group = await getGroup(tx, board.id, input.groupId)
    await tx
      .update(groups)
      .set({ title: input.title?.trim() || null })
      .where(eq(groups.id, group.id))
    changes.group(group.id)
  })
}

export function moveGroup(db: Db, actor: Actor, input: GroupMoveInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const group = await getGroup(tx, board.id, input.groupId)
    const position = positionAfter(
      without(await columnEntries(tx, board.id, input.column), group.id),
      input.afterId,
    )
    await tx.update(groups).set({ column: input.column, position }).where(eq(groups.id, group.id))
    changes.group(group.id)
    const members = await tx
      .update(items)
      .set({ column: input.column })
      .where(eq(items.groupId, group.id))
      .returning({ id: items.id })
    for (const m of members) changes.item(m.id)
  })
}

// ---------------------------------------------------------------------------
// Votes

/** Gives an item one more of your votes; several can go to the same item. */
export function addVote(db: Db, actor: Actor, input: VoteInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const item = await getItem(tx, board.id, input.itemId)
    // The budget is per column: sum this client's votes on items in the item's column.
    const [used] = await tx
      .select({ n: sum(votes.count).mapWith(Number) })
      .from(votes)
      .innerJoin(items, eq(items.id, votes.itemId))
      .where(
        and(
          eq(items.boardId, board.id),
          eq(items.column, item.column),
          eq(votes.clientId, actor.clientId),
        ),
      )
    if ((used?.n ?? 0) >= board.voteLimit) {
      throw new DomainError('VOTE_LIMIT', 'No votes left in this column')
    }
    await tx
      .insert(votes)
      .values({ itemId: item.id, clientId: actor.clientId })
      .onConflictDoUpdate({
        target: [votes.itemId, votes.clientId],
        set: { count: sql`${votes.count} + 1` },
      })
    changes.item(item.id)
  })
}

/** Takes back one of your own votes from an item (a no-op if you have none there). */
export function removeVote(db: Db, actor: Actor, input: VoteInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const item = await getItem(tx, board.id, input.itemId)
    const mine = and(eq(votes.itemId, item.id), eq(votes.clientId, actor.clientId))
    const [row] = await tx.select({ count: votes.count }).from(votes).where(mine)
    if (!row) return
    if (row.count > 1) {
      await tx
        .update(votes)
        .set({ count: sql`${votes.count} - 1` })
        .where(mine)
    } else {
      await tx.delete(votes).where(mine)
    }
    changes.item(item.id)
  })
}

// ---------------------------------------------------------------------------
// Settings

export function updateSettings(db: Db, actor: Actor, input: BoardSettingsInput): Promise<Changes> {
  return mutate(
    db,
    actor,
    async (tx, board, changes) => {
      if (!actor.isOwner) throw forbidden('Only the board owner can change settings')
      if (board.lockedAt && input.locked !== false) {
        throw new DomainError('LOCKED', 'This board is locked')
      }
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
      changes.board = true
    },
    { allowWhenLocked: true },
  )
}

/** Anyone can start or stop the shared timer, even on a locked board – it locks nothing. */
export function setTimer(db: Db, actor: Actor, input: BoardTimerInput): Promise<Changes> {
  return mutate(
    db,
    actor,
    async (tx, board, changes) => {
      await tx
        .update(boards)
        .set({
          timerEndsAt: input.seconds === null ? null : new Date(Date.now() + input.seconds * 1000),
          timerSeconds: input.seconds,
          timerHideItems: input.seconds !== null && (input.hideItems ?? false),
        })
        .where(eq(boards.id, board.id))
      changes.board = true
    },
    { allowWhenLocked: true },
  )
}

// ---------------------------------------------------------------------------
// Maintenance

export async function deleteInactiveBoards(db: Db, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(boards)
    .where(lt(boards.lastActivityAt, cutoff))
    .returning({ id: boards.id })
  return deleted.length
}
