import { and, eq, sql, sum } from 'drizzle-orm'
import type { VoteInput } from '@retromode/shared'
import type { Db } from '../db/client'
import { items, votes } from '../db/schema'
import type { Changes } from './changes'
import { DomainError } from './errors'
import { getItem, mutate, type Actor } from './mutate'

/** Gives an item one more of your votes; several can go to the same item. */
export function addVote(db: Db, actor: Actor, input: VoteInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const item = await getItem(tx, board.id, input.itemId)
    // The budget is per column: sum this client's votes on items in the item's column.
    const [used] = await tx
      .select({ n: sum(votes.count).mapWith(Number) })
      .from(votes)
      .innerJoin(items, eq(items.id, votes.itemId))
      .where(
        and(
          eq(items.boardId, board.id),
          eq(items.column, item.column),
          eq(votes.clientId, actor.clientId),
        ),
      )
    if ((used?.n ?? 0) >= board.voteLimit) {
      throw new DomainError('VOTE_LIMIT', 'No votes left in this column')
    }
    await tx
      .insert(votes)
      .values({ itemId: item.id, clientId: actor.clientId })
      .onConflictDoUpdate({
        target: [votes.itemId, votes.clientId],
        set: { count: sql`${votes.count} + 1` },
      })
    changes.item(item.id)
  })
}

/** Takes back one of your own votes from an item (a no-op if you have none there). */
export function removeVote(db: Db, actor: Actor, input: VoteInput): Promise<Changes> {
  return mutate(db, actor, async (tx, board, changes) => {
    const item = await getItem(tx, board.id, input.itemId)
    const mine = and(eq(votes.itemId, item.id), eq(votes.clientId, actor.clientId))
    const [row] = await tx.select({ count: votes.count }).from(votes).where(mine)
    if (!row) return
    if (row.count > 1) {
      await tx
        .update(votes)
        .set({ count: sql`${votes.count} - 1` })
        .where(mine)
    } else {
      await tx.delete(votes).where(mine)
    }
    changes.item(item.id)
  })
}
