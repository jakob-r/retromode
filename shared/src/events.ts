import type {
  BoardJoinInput,
  BoardNukeInput,
  BoardReadyInput,
  BoardSettingsInput,
  BoardTimerInput,
  GroupMergeInput,
  GroupMoveInput,
  GroupRenameInput,
  GroupUngroupInput,
  ItemCreateInput,
  ItemDeleteInput,
  ItemLinkInput,
  ItemMoveInput,
  ItemUpdateInput,
  VoteInput,
} from './schemas'
import type { Ack, BoardPatch, BoardSnapshot } from './types'

type Handler<I, O = null> = (input: I, ack: (res: Ack<O>) => void) => void

export interface ClientToServerEvents {
  'board:join': Handler<BoardJoinInput, BoardSnapshot>
  'board:sync': Handler<Record<string, never>, BoardSnapshot>
  'board:settings': Handler<BoardSettingsInput>
  'board:timer': Handler<BoardTimerInput>
  'board:ready': Handler<BoardReadyInput>
  'board:nuke': Handler<BoardNukeInput>
  'item:create': Handler<ItemCreateInput>
  'item:update': Handler<ItemUpdateInput>
  'item:delete': Handler<ItemDeleteInput>
  'item:move': Handler<ItemMoveInput>
  'item:link': Handler<ItemLinkInput>
  'group:merge': Handler<GroupMergeInput>
  'group:ungroup': Handler<GroupUngroupInput>
  'group:rename': Handler<GroupRenameInput>
  'group:move': Handler<GroupMoveInput>
  'vote:add': Handler<VoteInput>
  'vote:remove': Handler<VoteInput>
}

export interface ServerToClientEvents {
  'board:patch': (patch: BoardPatch) => void
  /** ready: how many of the people here said they're done with the running timer */
  presence: (data: { online: number; ready: number }) => void
  /** Everyone was ready, so the timer stopped early: time's up for everyone */
  'board:timeup': () => void
  /** The owner deleted the board; it no longer exists */
  'board:nuked': () => void
}

export type MutationEvent = Exclude<
  keyof ClientToServerEvents,
  'board:join' | 'board:sync' | 'board:nuke'
>
