/**
 * Pure board model used for rendering and for optimistic updates. The
 * optimistic operations mirror the server rules (backend/src/domain/boards.ts);
 * the server's patches are authoritative and overwrite whatever we guessed.
 */
import {
  positionAfter,
  positionsBetween,
  sortPositioned,
  type BoardPatch,
  type ColumnKey,
  type EntryRef,
  type Positioned,
  type PublicGroup,
  type PublicItem,
} from '@retromode/shared'

export interface BoardData {
  items: Record<string, PublicItem>
  groups: Record<string, PublicGroup>
}

export type Entry =
  | { type: 'item'; id: string; position: string; item: PublicItem }
  | {
      type: 'group'
      id: string
      position: string
      group: PublicGroup
      items: PublicItem[]
      votes: number
    }

export const emptyData = (): BoardData => ({ items: {}, groups: {} })

export function fromLists(groups: PublicGroup[], items: PublicItem[]): BoardData {
  return {
    groups: Object.fromEntries(groups.map((g) => [g.id, g])),
    items: Object.fromEntries(items.map((i) => [i.id, i])),
  }
}

export function groupMembers(data: BoardData, groupId: string): PublicItem[] {
  return sortPositioned(Object.values(data.items).filter((i) => i.groupId === groupId))
}

/** Top-level entries of a column (groups and ungrouped items), in display order. */
export function columnEntries(data: BoardData, column: ColumnKey): Entry[] {
  const entries: Entry[] = []
  for (const group of Object.values(data.groups)) {
    if (group.column !== column) continue
    const items = groupMembers(data, group.id)
    entries.push({
      type: 'group',
      id: group.id,
      position: group.position,
      group,
      items,
      votes: items.reduce((sum, i) => sum + i.votes, 0),
    })
  }
  for (const item of Object.values(data.items)) {
    if (item.column === column && item.groupId === null) {
      entries.push({ type: 'item', id: item.id, position: item.position, item })
    }
  }
  return sortPositioned(entries)
}

function topLevel(data: BoardData, column: ColumnKey): Positioned[] {
  return columnEntries(data, column).map(({ id, position }) => ({ id, position }))
}

export function votesUsed(data: BoardData, column: ColumnKey): number {
  return Object.values(data.items).filter((i) => i.column === column && i.votedByMe).length
}

export function columnCount(data: BoardData, column: ColumnKey): number {
  return Object.values(data.items).filter((i) => i.column === column).length
}

export function applyPatch(data: BoardData, patch: BoardPatch): BoardData {
  const items = { ...data.items }
  const groups = { ...data.groups }
  for (const item of patch.items ?? []) items[item.id] = item
  for (const group of patch.groups ?? []) groups[group.id] = group
  for (const id of patch.deletedItemIds ?? []) delete items[id]
  for (const id of patch.deletedGroupIds ?? []) delete groups[id]
  return { items, groups }
}

// ---------------------------------------------------------------------------
// Optimistic operations (mutate a copy)

function clone(data: BoardData): BoardData {
  return { items: { ...data.items }, groups: { ...data.groups } }
}

const without = (entries: Positioned[], id: string) => entries.filter((e) => e.id !== id)

function dissolveIfSmall(data: BoardData, groupId: string): void {
  const group = data.groups[groupId]
  if (!group) return
  const rest = groupMembers(data, groupId)
  if (rest.length >= 2) return
  const last = rest[0]
  if (last) {
    data.items[last.id] = { ...last, groupId: null, column: group.column, position: group.position }
  }
  delete data.groups[groupId]
}

export function createItem(data: BoardData, item: Omit<PublicItem, 'position'>): BoardData {
  const next = clone(data)
  next.items[item.id] = { ...item, position: positionAfter(topLevel(data, item.column), null) }
  return next
}

export function deleteItem(data: BoardData, itemId: string): BoardData {
  const item = data.items[itemId]
  if (!item) return data
  const next = clone(data)
  delete next.items[itemId]
  if (item.groupId) dissolveIfSmall(next, item.groupId)
  return next
}

export function moveItem(
  data: BoardData,
  input: { itemId: string; column: ColumnKey; groupId: string | null; afterId: string | null },
): BoardData {
  const item = data.items[input.itemId]
  if (!item) return data
  const next = clone(data)
  let column = input.column
  let position: string
  if (input.groupId) {
    const group = data.groups[input.groupId]
    if (!group) return data
    column = group.column
    position = positionAfter(without(groupMembers(data, group.id), item.id), input.afterId)
  } else {
    position = positionAfter(without(topLevel(data, column), item.id), input.afterId)
  }
  next.items[item.id] = { ...item, column, position, groupId: input.groupId }
  if (item.groupId && item.groupId !== input.groupId) dissolveIfSmall(next, item.groupId)
  return next
}

/** The group a target stands for: groups themselves, or the group an item sits in. */
function targetGroupId(data: BoardData, ref: EntryRef): string | null {
  if (ref.type === 'group') return ref.id
  return data.items[ref.id]?.groupId ?? null
}

export function merge(
  data: BoardData,
  input: { source: EntryRef; target: EntryRef; newGroupId: string },
): BoardData {
  if (input.source.id === input.target.id) return data
  const sourceItems =
    input.source.type === 'group'
      ? groupMembers(data, input.source.id)
      : [data.items[input.source.id]].filter((i): i is PublicItem => !!i)
  const existingGroupId = targetGroupId(data, input.target)
  if (existingGroupId && sourceItems.every((i) => i.groupId === existingGroupId)) return data

  const next = clone(data)
  let group: PublicGroup
  if (existingGroupId) {
    const g = data.groups[existingGroupId]
    if (!g) return data
    group = g
  } else {
    const targetItem = data.items[input.target.id]
    if (!targetItem) return data
    group = {
      id: input.newGroupId,
      column: targetItem.column,
      position: targetItem.position,
      title: input.source.type === 'group' ? (data.groups[input.source.id]?.title ?? null) : null,
    }
    next.groups[group.id] = group
    const [first] = positionsBetween(null, null, 1)
    next.items[targetItem.id] = { ...targetItem, groupId: group.id, position: first! }
  }

  const moving = sourceItems.filter((i) => i.groupId !== group.id)
  const last = groupMembers(next, group.id).at(-1)?.position ?? null
  const keys = positionsBetween(last, null, moving.length)
  const oldGroups = new Set<string>()
  moving.forEach((item, index) => {
    next.items[item.id] = {
      ...item,
      groupId: group.id,
      column: group.column,
      position: keys[index]!,
    }
    if (item.groupId) oldGroups.add(item.groupId)
  })
  for (const id of oldGroups) dissolveIfSmall(next, id)
  return next
}

export function ungroup(data: BoardData, groupId: string): BoardData {
  const group = data.groups[groupId]
  if (!group) return data
  const next = clone(data)
  const members = groupMembers(data, groupId)
  const entries = topLevel(data, group.column)
  const following = entries[entries.findIndex((e) => e.id === groupId) + 1]?.position ?? null
  const keys = positionsBetween(group.position, following, members.length)
  members.forEach((item, index) => {
    next.items[item.id] = { ...item, groupId: null, position: keys[index]! }
  })
  delete next.groups[groupId]
  return next
}

export function moveGroup(
  data: BoardData,
  input: { groupId: string; column: ColumnKey; afterId: string | null },
): BoardData {
  const group = data.groups[input.groupId]
  if (!group) return data
  const next = clone(data)
  const position = positionAfter(without(topLevel(data, input.column), group.id), input.afterId)
  next.groups[group.id] = { ...group, column: input.column, position }
  for (const item of groupMembers(data, group.id)) {
    next.items[item.id] = { ...item, column: input.column }
  }
  return next
}

export function toggleVote(data: BoardData, itemId: string): BoardData {
  const item = data.items[itemId]
  if (!item) return data
  const next = clone(data)
  next.items[itemId] = {
    ...item,
    votedByMe: !item.votedByMe,
    votes: item.votes + (item.votedByMe ? -1 : 1),
  }
  return next
}

export function patchItem(data: BoardData, itemId: string, fields: Partial<PublicItem>): BoardData {
  const item = data.items[itemId]
  if (!item) return data
  const next = clone(data)
  next.items[itemId] = { ...item, ...fields }
  return next
}

export function patchGroup(
  data: BoardData,
  groupId: string,
  fields: Partial<PublicGroup>,
): BoardData {
  const group = data.groups[groupId]
  if (!group) return data
  const next = clone(data)
  next.groups[groupId] = { ...group, ...fields }
  return next
}

/**
 * The id of the entry right before `id` in its container, i.e. the `afterId`
 * that keeps it where it is. Used to skip no-op moves.
 */
export function predecessorId(data: BoardData, ref: EntryRef): string | null | undefined {
  const container: Positioned[] =
    ref.type === 'item' && data.items[ref.id]?.groupId
      ? groupMembers(data, data.items[ref.id]!.groupId!)
      : topLevel(
          data,
          (ref.type === 'item' ? data.items[ref.id]?.column : data.groups[ref.id]?.column) ??
            'well',
        )
  const index = container.findIndex((e) => e.id === ref.id)
  if (index === -1) return undefined
  return container[index - 1]?.id ?? null
}
