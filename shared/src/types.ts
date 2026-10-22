import type { ColumnKey, ErrorCode } from './constants'
import type { EntryRef } from './schemas'

export interface PublicBoard {
  slug: string
  title: string
  /** Votes per person per column */
  voteLimit: number
  locked: boolean
  /** The shared countdown, while it runs */
  timer: PublicTimer | null
  /** Personalized: whether the receiving client is the board owner */
  isOwner: boolean
  createdAt: string
}

export interface PublicTimer {
  /** What it was started with */
  seconds: number
  /** Left at the moment the server sent this (relative, so client clocks don't matter) */
  remainingMs: number
  /** Everyone sees only their own items' text until it runs out */
  hideItems: boolean
  /** Personalized: whether the receiving client said they're done */
  meReady: boolean
}

export interface PublicGroup {
  id: string
  column: ColumnKey
  position: string
  title: string | null
}

export interface PublicItem {
  id: string
  column: ColumnKey
  groupId: string | null
  position: string
  text: string
  /** null = posted anonymously */
  nickname: string | null
  /** Personalized: written by the receiving client */
  mine: boolean
  votes: number
  /** Personalized: how many of the receiving client's votes went to this item */
  myVotes: number
  /** Action items only: the "To improve" item or group this one is tied to */
  link: EntryRef | null
  createdAt: string
  updatedAt: string
}

export interface BoardSnapshot {
  board: PublicBoard
  groups: PublicGroup[]
  items: PublicItem[]
  online: number
  /** How many of the people online are done with the running timer */
  ready: number
}

/** A set of changes, applied atomically by clients. */
export interface BoardPatch {
  board?: PublicBoard
  items?: PublicItem[]
  groups?: PublicGroup[]
  deletedItemIds?: string[]
  deletedGroupIds?: string[]
}

export type Ack<T = null> = { ok: true; data: T } | { ok: false; error: ErrorCode; message: string }

export interface CreateBoardResponse {
  slug: string
  ownerKey: string
}
