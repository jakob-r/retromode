import { eq } from 'drizzle-orm'
import {
  LINK_SOURCE,
  LINK_TARGET,
  positionAfter,
  positionAtEnd,
  type EntryRef,
  type ItemCreateInput,
  type ItemDeleteInput,
  type ItemLinkInput,
  type ItemMoveInput,
  type ItemUpdateInput,
} from '@retromode/shared'
import type { Db, Tx } from '../db/client'
import { items } from '../db/schema'
import type { Changes } from './changes'
import { forbidden, invalid } from './errors'
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

export function createItem(db: Db, actor: Actor, input: ItemCreateInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    if (input.link && input.column !== LINK_SOURCE) throw invalid('Only action items can be tied')
    const link = await linkColumns(tx, board.id, input.link ?? null)
    // Newest items go to the top of the column, right below the input. Action items
    // made from something to improve go to the bottom, after the ones already planned.
    const siblings = await columnEntries(tx, board.id, input.column)
    const position = input.link ? positionAtEnd(siblings) : positionAfter(siblings, null)
    const inserted = await tx
      .insert(items)
      .values({
        id: input.id,
        boardId: board.id,
        column: input.column,
        position,
        text: input.text,
        authorClientId: actor.clientId,
        authorNickname: input.nickname,
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
    await tx
      .update(items)
      .set({
        text: input.text ?? item.text,
        authorNickname: input.nickname === undefined ? item.authorNickname : input.nickname,
        updatedAt: new Date(),
      })
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

/** Ties an action item to something to improve (target null cuts the string). */
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
