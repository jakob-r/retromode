import { create } from 'zustand'
import type {
  Ack,
  BoardSettingsInput,
  BoardSnapshot,
  ColumnKey,
  EntryRef,
  ErrorCode,
  MutationEvent,
  PublicBoard,
} from '@retromode/shared'
import { pickEmoji } from '../lib/emoji'
import * as model from '../lib/model'
import { forgetOwnerKey, getOwnerKey, uuid } from '../lib/identity'
import { createSocket, type RetroSocket } from '../realtime/socket'
import { toast } from './toasts'

export type Status = 'connecting' | 'ready' | 'reconnecting' | 'not-found' | 'nuked'

export interface VoteSpray {
  key: string
  itemId: string
  emoji: string
}

interface BoardStore extends model.BoardData {
  slug: string | null
  status: Status
  board: PublicBoard | null
  online: number
  /** How many of the people here are done with the running timer */
  ready: number
  /** Items that arrived from other people since load, for a short glow */
  remoteArrivals: Record<string, true>
  /** Items created moments ago (by anyone), for the emoji burst */
  freshItems: Record<string, true>
  /** Emoji sprays playing on vote buttons right now, one per new vote (by anyone) */
  voteSprays: VoteSpray[]
  /** Vote counts the columns are sorted by; they catch up once nobody voted for a moment */
  sortVotes: model.SortVotes
  /** Local clock time when the shared timer runs out, while it runs */
  timerEndsAt: number | null
  /** Bumped each time the timer runs out while we watched it */
  timeUps: number
}

const initial = (): BoardStore => ({
  slug: null,
  status: 'connecting',
  board: null,
  online: 0,
  ready: 0,
  remoteArrivals: {},
  freshItems: {},
  voteSprays: [],
  sortVotes: {},
  timerEndsAt: null,
  timeUps: 0,
  ...model.emptyData(),
})

export const useBoard = create<BoardStore>(() => initial())

const set = useBoard.setState
const get = useBoard.getState
const data = (): model.BoardData => ({ items: get().items, groups: get().groups })

let socket: RetroSocket | null = null

const patchListeners = new Set<() => void>()

/**
 * Resolves once the next server patch has been applied (or after `timeoutMs`).
 * The server acks a change before it broadcasts the patch, so this is how to
 * see a change's authoritative result.
 */
export function nextPatch(timeoutMs = 1000): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timeout)
      patchListeners.delete(done)
      resolve()
    }
    const timeout = setTimeout(done, timeoutMs)
    patchListeners.add(done)
  })
}

/** The board is gone: drop everything we held about it, here and in this browser. */
function wipe() {
  const slug = get().slug
  if (slug) forgetOwnerKey(slug)
  syncTimer(null)
  set({ ...initial(), slug, status: 'nuked' })
}

const FRESH_MS = 1500

function markFresh(ids: string[]) {
  if (ids.length === 0) return
  const fresh = { ...get().freshItems }
  for (const id of ids) fresh[id] = true
  set({ freshItems: fresh })
  setTimeout(() => {
    const rest = { ...get().freshItems }
    for (const id of ids) delete rest[id]
    set({ freshItems: rest })
  }, FRESH_MS)
}

const SPRAY_MS = 1400

/** Plays the column's emoji over an item's vote button; the vote count picks it, so all clients agree. */
function sprayVote(itemId: string) {
  const item = get().items[itemId]
  if (!item) return
  const key = `${itemId}:${item.votes}`
  const emoji = pickEmoji(item.column, key)
  if (!emoji || get().voteSprays.some((s) => s.key === key)) return
  set({ voteSprays: [...get().voteSprays, { key, itemId, emoji }] })
  setTimeout(() => set({ voteSprays: get().voteSprays.filter((s) => s.key !== key) }), SPRAY_MS)
}

const SORT_DELAY_MS = 500
let sortTimeout: ReturnType<typeof setTimeout> | undefined
let seenVotes: Record<string, number> = {}

// Re-sort by votes only once nobody (here or elsewhere) voted for a moment, so
// cards don't jump away from under someone's cursor while votes are flowing in.
useBoard.subscribe((state, prev) => {
  if (state.items === prev.items) return
  const votes = model.voteCounts(state)
  const voted = Object.entries(votes).some(([id, n]) => id in seenVotes && seenVotes[id] !== n)
  seenVotes = votes
  if (!voted) return
  clearTimeout(sortTimeout)
  sortTimeout = setTimeout(() => set({ sortVotes: model.voteCounts(get()) }), SORT_DELAY_MS)
})

let timeUpTimeout: ReturnType<typeof setTimeout> | undefined

/** Follows the board's timer; when it runs out here, everyone watching gets the time-up moment. */
function syncTimer(board: PublicBoard | null) {
  clearTimeout(timeUpTimeout)
  const timer = board?.timer
  if (!timer) {
    set({ timerEndsAt: null })
    return
  }
  set({ timerEndsAt: Date.now() + timer.remainingMs })
  timeUpTimeout = setTimeout(
    () => set({ timerEndsAt: null, timeUps: get().timeUps + 1 }),
    timer.remainingMs,
  )
}

function applySnapshot(snapshot: BoardSnapshot) {
  syncTimer(snapshot.board)
  const data = model.fromLists(snapshot.groups, snapshot.items)
  clearTimeout(sortTimeout)
  seenVotes = model.voteCounts(data)
  set({
    status: 'ready',
    board: snapshot.board,
    online: snapshot.online,
    ready: snapshot.ready,
    sortVotes: seenVotes,
    ...data,
  })
}

/** Connects to a board; returns a cleanup function. Rejoins automatically after reconnects. */
export function connectBoard(slug: string): () => void {
  socket?.disconnect()
  syncTimer(null)
  set({ ...initial(), slug })
  const s = createSocket()
  socket = s

  const join = () =>
    s.emit('board:join', { slug, ownerKey: getOwnerKey(slug) }, (res) => {
      if (res.ok) applySnapshot(res.data)
      else if (res.error === 'NOT_FOUND') set({ status: 'not-found' })
      else toast(res.message, 'error')
    })

  s.on('connect', join)
  s.on('disconnect', () => {
    if (get().status === 'ready') set({ status: 'reconnecting' })
  })
  s.on('connect_error', () => {
    if (get().status === 'ready') set({ status: 'reconnecting' })
  })
  s.on('presence', ({ online, ready }) => set({ online, ready }))
  // Everyone was ready before the timer ran out; the patch stopping it came just before
  s.on('board:timeup', () => set({ timerEndsAt: null, timeUps: get().timeUps + 1 }))
  s.on('board:nuked', () => {
    wipe()
    s.disconnect()
  })
  s.on('board:patch', (patch) => {
    const before = get().items
    const arrivals = { ...get().remoteArrivals }
    const created: string[] = []
    const voted: string[] = []
    for (const item of patch.items ?? []) {
      const old = before[item.id]
      // Our own votes were already counted optimistically, so only other people's show up here
      if (old && item.votes > old.votes) voted.push(item.id)
      if (old) continue
      created.push(item.id)
      if (!item.mine) arrivals[item.id] = true
    }
    set({
      ...model.applyPatch(data(), patch),
      ...(patch.board && { board: patch.board }),
      remoteArrivals: arrivals,
    })
    markFresh(created)
    voted.forEach(sprayVote)
    if (patch.board) syncTimer(patch.board)
    patchListeners.forEach((listener) => listener())
  })

  return () => {
    syncTimer(null)
    s.disconnect()
    if (socket === s) socket = null
  }
}

/** Re-fetches the full board, e.g. after a rejected optimistic update. */
function resync() {
  socket?.emit('board:sync', {}, (res) => {
    if (res.ok) applySnapshot(res.data)
  })
}

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  LOCKED: 'This board is locked 🔒',
  VOTE_LIMIT: 'No votes left in this column',
  FORBIDDEN: "You can't do that here",
  RATE_LIMITED: 'Whoa, slow down a little 🐢',
  NOT_FOUND: 'That was just removed by someone else',
}

const OFFLINE = 'You are offline – reconnecting…'

/**
 * Apply an optimistic change, send it, and roll back via resync if the server
 * says no. Resolves with the server's answer.
 */
function mutate(
  event: MutationEvent,
  input: unknown,
  optimistic?: (d: model.BoardData) => model.BoardData,
): Promise<Ack> {
  const s = socket
  if (!s?.connected) {
    toast(OFFLINE, 'error')
    return Promise.resolve({ ok: false, error: 'INTERNAL', message: OFFLINE })
  }
  if (optimistic) set(optimistic(data()))
  const emit = s.emit as (e: string, i: unknown, ack: (res: Ack) => void) => void
  return new Promise((resolve) => {
    emit.call(s, event, input, (res: Ack) => {
      resolve(res)
      if (res.ok) return
      toast(MESSAGES[res.error] ?? 'Something went wrong – resyncing', 'error')
      resync()
    })
  })
}

// ---------------------------------------------------------------------------
// Actions

export const actions = {
  createItem(
    column: ColumnKey,
    text: string,
    anonymous: boolean,
    nickname: string | null,
    link: EntryRef | null = null,
  ) {
    const id = uuid()
    const now = new Date().toISOString()
    const named = !anonymous && !!nickname
    const sent = mutate(
      'item:create',
      {
        id,
        column,
        text,
        anonymous: !named,
        nickname: nickname ?? undefined,
        link: link ?? undefined,
      },
      (d) =>
        model.createItem(d, {
          id,
          column,
          groupId: null,
          text,
          nickname: named ? nickname : null,
          mine: true,
          votes: 0,
          myVotes: 0,
          link,
          createdAt: now,
          updatedAt: now,
        }),
    )
    markFresh([id])
    return { id, sent }
  },

  updateItem(itemId: string, text: string, anonymous: boolean, nickname: string | null) {
    const named = !anonymous && !!nickname
    return mutate(
      'item:update',
      { itemId, text, anonymous: !named, nickname: nickname ?? undefined },
      (d) => model.patchItem(d, itemId, { text, nickname: named ? nickname : null }),
    )
  },

  deleteItem(itemId: string) {
    return mutate('item:delete', { itemId }, (d) => model.deleteItem(d, itemId))
  },

  moveItem(itemId: string, column: ColumnKey, groupId: string | null, afterId: string | null) {
    const input = { itemId, column, groupId, afterId }
    return mutate('item:move', input, (d) => model.moveItem(d, input))
  },

  /** Ties an action item to something to improve (null cuts the string). */
  link(itemId: string, target: EntryRef | null) {
    return mutate('item:link', { itemId, target }, (d) => model.link(d, itemId, target))
  },

  merge(source: EntryRef, target: EntryRef) {
    const input = { source, target, newGroupId: uuid() }
    return mutate('group:merge', input, (d) => model.merge(d, input))
  },

  ungroup(groupId: string) {
    return mutate('group:ungroup', { groupId }, (d) => model.ungroup(d, groupId))
  },

  renameGroup(groupId: string, title: string | null) {
    return mutate('group:update', { groupId, title }, (d) =>
      model.patchGroup(d, groupId, { title }),
    )
  },

  moveGroup(groupId: string, column: ColumnKey, afterId: string | null) {
    const input = { groupId, column, afterId }
    return mutate('group:move', input, (d) => model.moveGroup(d, input))
  },

  /** Returns false (without sending) when the column's vote budget is spent. */
  addVote(itemId: string): boolean {
    const { board, items } = get()
    const item = items[itemId]
    if (!board || !item) return false
    if (model.votesUsed(data(), item.column) >= board.voteLimit) {
      toast(MESSAGES.VOTE_LIMIT!, 'error')
      return false
    }
    mutate('vote:add', { itemId }, (d) => model.vote(d, itemId, 1))
    sprayVote(itemId)
    return true
  },

  /** Takes back one of my own votes. */
  removeVote(itemId: string) {
    if (!get().items[itemId]?.myVotes) return
    mutate('vote:remove', { itemId }, (d) => model.vote(d, itemId, -1))
  },

  updateSettings(input: BoardSettingsInput) {
    const board = get().board
    if (board) {
      set({
        board: {
          ...board,
          ...(input.title !== undefined && { title: input.title }),
          ...(input.voteLimit !== undefined && { voteLimit: input.voteLimit }),
          ...(input.locked !== undefined && { locked: input.locked }),
        },
      })
    }
    mutate('board:settings', input)
  },

  /** Owner only: deletes the board and everything on it for everyone. Resolves once it's gone. */
  nuke(): Promise<boolean> {
    const s = socket
    if (!s?.connected) {
      toast(OFFLINE, 'error')
      return Promise.resolve(false)
    }
    return new Promise((resolve) => {
      s.emit('board:nuke', { confirm: 'NUKE' }, (res) => {
        if (!res.ok) {
          toast(MESSAGES[res.error] ?? 'Something went wrong', 'error')
          return resolve(false)
        }
        wipe()
        s.disconnect()
        resolve(true)
      })
    })
  },

  /** Starts the shared timer for everyone (null stops it). */
  setTimer(seconds: number | null, hideItems = false) {
    const board = get().board
    if (board && socket?.connected) {
      const timer =
        seconds === null
          ? null
          : { seconds, remainingMs: seconds * 1000, hideItems, meReady: false }
      set({ board: { ...board, timer }, ready: 0 })
      syncTimer({ ...board, timer })
    }
    mutate('board:timer', { seconds, hideItems })
  },

  /** Says I'm done with the running timer (or not anymore); once everyone is, it stops early. */
  setReady(ready: boolean) {
    const { board, ready: count } = get()
    if (!board?.timer || board.timer.meReady === ready || !socket?.connected) return
    set({
      board: { ...board, timer: { ...board.timer, meReady: ready } },
      ready: Math.max(0, count + (ready ? 1 : -1)),
    })
    mutate('board:ready', { ready })
  },
}
