import { and, eq, isNull } from 'drizzle-orm'
import { sortPositioned, type ColumnKey, type EntryRef, type Positioned } from '@retromode/shared'
import type { Db, Tx } from '../db/client'
import { boards, groups, items, type BoardRow, type GroupRow, type ItemRow } from '../db/schema'
import { Changes } from './changes'
import { locked, notFound } from './errors'

/** The identity of whoever performs an action on a joined board. */
export interface Actor {
  boardId: string
  clientId: string
  isOwner: boolean
}

/**
 * Runs a mutation in a transaction holding a row lock on the board, so all
 * writes to one board are serialized (positions, vote budgets, grouping).
 */
export async function mutate(
  db: Db,
  actor: Actor,
  fn: (tx: Tx, board: BoardRow, changes: Changes) => Promise<void>,
  { allowWhenLocked = false } = {},
): Promise<Changes> {
  return db.transaction(async (tx) => {
    const [board] = await tx.select().from(boards).where(eq(boards.id, actor.boardId)).for('update')
    if (!board) throw notFound('Board')
    if (board.lockedAt && !allowWhenLocked) throw locked()
    const changes = new Changes()
    await fn(tx, board, changes)
    if (!changes.isEmpty) {
      await tx.update(boards).set({ lastActivityAt: new Date() }).where(eq(boards.id, board.id))
    }
    return changes
  })
}

export async function getItem(tx: Tx, boardId: string, itemId: string): Promise<ItemRow> {
  const [item] = await tx
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.boardId, boardId)))
  if (!item) throw notFound('Item')
  return item
}

export async function getGroup(tx: Tx, boardId: string, groupId: string): Promise<GroupRow> {
  const [group] = await tx
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.boardId, boardId)))
  if (!group) throw notFound('Group')
  return group
}

/** Top-level entries of a column: groups and items that are not in a group. */
export async function columnEntries(
  tx: Tx,
  boardId: string,
  column: ColumnKey,
): Promise<Positioned[]> {
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

export async function groupItems(tx: Tx, groupId: string): Promise<ItemRow[]> {
  const rows = await tx.select().from(items).where(eq(items.groupId, groupId))
  return sortPositioned(rows)
}

export const without = (entries: Positioned[], id: string) => entries.filter((e) => e.id !== id)

/** A group with fewer than two items is dissolved; a remaining item takes the group's place. */
export async function dissolveIfSmall(tx: Tx, groupId: string, changes: Changes): Promise<void> {
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

/**
 * Before an entry disappears, re-ties the strings attached to it to `itemId`
 * (e.g. the item left over from a dissolved group), or cuts them.
 */
export async function retargetLinks(
  tx: Tx,
  from: EntryRef,
  itemId: string | null,
  changes: Changes,
) {
  const column = from.type === 'group' ? items.linkedGroupId : items.linkedItemId
  const rows = await tx
    .update(items)
    .set({ linkedItemId: itemId, linkedGroupId: null })
    .where(eq(column, from.id))
    .returning({ id: items.id })
  for (const row of rows) changes.item(row.id)
}
