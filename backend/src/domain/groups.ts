import { eq } from 'drizzle-orm'
import {
  positionAfter,
  positionsBetween,
  sortPositioned,
  type EntryRef,
  type GroupMergeInput,
  type GroupMoveInput,
  type GroupRenameInput,
  type GroupUngroupInput,
} from '@retromode/shared'
import type { Db, Tx } from '../db/client'
import { groups, items, type GroupRow, type ItemRow } from '../db/schema'
import type { Changes } from './changes'
import { invalid } from './errors'
import {
  columnEntries,
  dissolveIfSmall,
  getGroup,
  getItem,
  groupItems,
  mutate,
  retargetLinks,
  without,
  type Actor,
} from './mutate'

/** A target item that sits in a group stands for its group. */
async function resolveTarget(tx: Tx, boardId: string, ref: EntryRef) {
  if (ref.type === 'group') return { group: await getGroup(tx, boardId, ref.id) }
  const item = await getItem(tx, boardId, ref.id)
  if (item.groupId) return { group: await getGroup(tx, boardId, item.groupId) }
  return { item }
}

export function merge(db: Db, actor: Actor, input: GroupMergeInput): Promise<Changes> {
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

export function renameGroup(db: Db, actor: Actor, input: GroupRenameInput): Promise<Changes> {
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
