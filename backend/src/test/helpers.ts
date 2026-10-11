import { randomUUID } from 'node:crypto'
import type { ColumnKey } from '@retromode/shared'
import { createDb } from '../db/client'
import * as boards from '../domain/boards'
import { testDatabaseUrl } from './global-setup'

export const { db, pool } = createDb(testDatabaseUrl())

export async function setupBoard(voteLimit = 3) {
  const owner = randomUUID()
  const { slug, ownerKey } = await boards.createBoard(db, { clientId: owner, voteLimit })
  const board = (await boards.findBoardBySlug(db, slug))!
  const actor = (clientId: string = randomUUID()): boards.Actor => ({
    boardId: board.id,
    clientId,
    isOwner: boards.isBoardOwner(board, clientId),
  })
  const ownerActor = actor(owner)

  async function addItem(
    by: boards.Actor,
    column: ColumnKey = 'well',
    text = 'hello',
    opts: { anonymous?: boolean; nickname?: string } = {},
  ) {
    const id = randomUUID()
    await boards.createItem(db, by, {
      id,
      column,
      text,
      anonymous: opts.anonymous ?? false,
      nickname: opts.nickname,
    })
    return id
  }

  const state = () => boards.loadBoardState(db, board.id)

  return { board, slug, ownerKey, owner, ownerActor, actor, addItem, state }
}
