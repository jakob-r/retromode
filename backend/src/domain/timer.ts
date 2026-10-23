import { eq } from 'drizzle-orm'
import type { BoardReadyInput, BoardTimerInput } from '@retromode/shared'
import type { Db } from '../db/client'
import { boards, type BoardRow } from '../db/schema'
import { Changes } from './changes'
import { mutate, type Actor } from './mutate'

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
          timerReadyClientIds: [],
        })
        .where(eq(boards.id, board.id))
      changes.boardChanged()
    },
    { allowWhenLocked: true },
  )
}

const timerRunning = (board: BoardRow) =>
  board.timerEndsAt !== null && board.timerEndsAt.getTime() > Date.now()

/** Says I'm done with the running timer (or not anymore). Without a running timer there's nothing to be ready for. */
export function setReady(db: Db, actor: Actor, input: BoardReadyInput): Promise<Changes> {
  return mutate(
    db,
    actor,
    async (tx, board, changes) => {
      if (!timerRunning(board)) return
      const others = board.timerReadyClientIds.filter((id) => id !== actor.clientId)
      const ready = input.ready ? [...others, actor.clientId] : others
      if (ready.length === board.timerReadyClientIds.length) return
      await tx.update(boards).set({ timerReadyClientIds: ready }).where(eq(boards.id, board.id))
      changes.boardChanged()
    },
    { allowWhenLocked: true },
  )
}

/** Who among `online` is done with the running timer. */
export function readyAmong(board: BoardRow, online: ReadonlySet<string>): number {
  if (!timerRunning(board)) return 0
  return board.timerReadyClientIds.filter((id) => online.has(id)).length
}

const allReady = (board: BoardRow | undefined, online: ReadonlySet<string>) =>
  !!board && online.size > 0 && readyAmong(board, online) === online.size

/**
 * Counts who among `online` is done with the running timer, and stops it once
 * all of them are (`finished` then holds the changes to broadcast).
 */
export async function settleReady(
  db: Db,
  boardId: string,
  online: ReadonlySet<string>,
): Promise<{ ready: number; finished: Changes | null }> {
  // Runs on every join and leave: only lock the board when there's a timer to stop
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId))
  if (!board || !allReady(board, online)) {
    return { ready: board ? readyAmong(board, online) : 0, finished: null }
  }
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(boards).where(eq(boards.id, boardId)).for('update')
    if (!locked || !allReady(locked, online)) {
      return { ready: locked ? readyAmong(locked, online) : 0, finished: null }
    }
    await tx
      .update(boards)
      .set({ timerEndsAt: null, timerReadyClientIds: [] })
      .where(eq(boards.id, boardId))
    return { ready: 0, finished: new Changes().boardChanged() }
  })
}
