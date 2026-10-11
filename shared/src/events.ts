import type {
  BoardJoinInput,
  BoardSettingsInput,
  BoardTimerInput,
  GroupMergeInput,
  GroupMoveInput,
  GroupUngroupInput,
  GroupUpdateInput,
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
  'item:create': Handler<ItemCreateInput>
  'item:update': Handler<ItemUpdateInput>
  'item:delete': Handler<ItemDeleteInput>
  'item:move': Handler<ItemMoveInput>
  'item:link': Handler<ItemLinkInput>
  'group:merge': Handler<GroupMergeInput>
  'group:ungroup': Handler<GroupUngroupInput>
  'group:update': Handler<GroupUpdateInput>
  'group:move': Handler<GroupMoveInput>
  'vote:add': Handler<VoteInput>
  'vote:remove': Handler<VoteInput>
}

export interface ServerToClientEvents {
  'board:patch': (patch: BoardPatch) => void
  presence: (data: { online: number }) => void
}

export type MutationEvent = Exclude<keyof ClientToServerEvents, 'board:join' | 'board:sync'>
