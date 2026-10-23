import { randomUUID } from 'node:crypto'
import type { ColumnKey } from '@retromode/shared'
import { createDb } from '../db/client'
import * as domain from '../domain'
import { testDatabaseUrl } from './global-setup'

export const { db, pool } = createDb(testDatabaseUrl())

export async function setupBoard(voteLimit = 3) {
  const owner = randomUUID()
  const { slug, ownerKey } = await domain.createBoard(db, { clientId: owner, voteLimit })
  const board = (await domain.findBoardBySlug(db, slug))!
  const actor = (clientId: string = randomUUID()): domain.Actor => ({
    boardId: board.id,
    clientId,
    isOwner: domain.isBoardOwner(board, clientId),
  })
  const ownerActor = actor(owner)

  async function addItem(
    by: domain.Actor,
    column: ColumnKey = 'well',
    text = 'hello',
    nickname: string | null = null,
  ) {
    const id = randomUUID()
    await domain.createItem(db, by, {
      id,
      column,
      text,
      nickname,
    })
    return id
  }

  const state = () => domain.loadBoardState(db, board.id)

  return { board, slug, ownerKey, owner, ownerActor, actor, addItem, state }
}
