import type {
  BoardPatch,
  BoardSnapshot,
  PublicBoard,
  PublicGroup,
  PublicItem,
  PublicTimer,
} from '@retromode/shared'
import type { BoardRow, GroupRow, ItemRow } from '../db/schema'
import type { BoardState } from './boards'
import type { Changes } from './changes'

/**
 * Who receives a payload. Public payloads never contain client ids; ownership
 * and own votes are only ever expressed as per-recipient booleans.
 */
export interface Viewer {
  clientId: string
  isOwner: boolean
}

export function toPublicBoard(board: BoardRow, viewer: Viewer): PublicBoard {
  return {
    slug: board.slug,
    title: board.title,
    voteLimit: board.voteLimit,
    locked: board.lockedAt !== null,
    timer: toPublicTimer(board, viewer),
    isOwner: viewer.isOwner,
    createdAt: board.createdAt.toISOString(),
  }
}

function toPublicTimer(board: BoardRow, viewer: Viewer, now = Date.now()): PublicTimer | null {
  if (!board.timerEndsAt || board.timerSeconds === null) return null
  const remainingMs = board.timerEndsAt.getTime() - now
  return remainingMs > 0
    ? {
        seconds: board.timerSeconds,
        remainingMs,
        hideItems: board.timerHideItems,
        meReady: board.timerReadyClientIds.includes(viewer.clientId),
      }
    : null
}

export function toPublicGroup(group: GroupRow): PublicGroup {
  return { id: group.id, column: group.column, position: group.position, title: group.title }
}

export function toPublicItem(
  item: ItemRow,
  voters: ReadonlyMap<string, number> | undefined,
  viewer: Viewer,
): PublicItem {
  return {
    id: item.id,
    column: item.column,
    groupId: item.groupId,
    position: item.position,
    text: item.text,
    nickname: item.authorNickname,
    mine: item.authorClientId === viewer.clientId,
    votes: voters ? [...voters.values()].reduce((sum, n) => sum + n, 0) : 0,
    myVotes: voters?.get(viewer.clientId) ?? 0,
    link: item.linkedGroupId
      ? { type: 'group', id: item.linkedGroupId }
      : item.linkedItemId
        ? { type: 'item', id: item.linkedItemId }
        : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export function snapshotFor(
  state: BoardState,
  viewer: Viewer,
  online: number,
  ready = 0,
): BoardSnapshot {
  return {
    board: toPublicBoard(state.board, viewer),
    groups: state.groups.map(toPublicGroup),
    items: state.items.map((i) => toPublicItem(i, state.voters.get(i.id), viewer)),
    online,
    ready,
  }
}

export function patchFor(state: BoardState, changes: Changes, viewer: Viewer): BoardPatch {
  const patch: BoardPatch = {}
  if (changes.board) patch.board = toPublicBoard(state.board, viewer)
  if (state.items.length)
    patch.items = state.items.map((i) => toPublicItem(i, state.voters.get(i.id), viewer))
  if (state.groups.length) patch.groups = state.groups.map(toPublicGroup)
  if (changes.deletedItemIds.size) patch.deletedItemIds = [...changes.deletedItemIds]
  if (changes.deletedGroupIds.size) patch.deletedGroupIds = [...changes.deletedGroupIds]
  return patch
}
