import type { FastifyBaseLogger } from 'fastify'
import type { Db } from '../db/client'
import { deleteInactiveBoards } from '../domain/boards'

const SIX_HOURS = 6 * 60 * 60 * 1000

/** Deletes boards without activity for `retentionDays`; runs at start and every 6 hours. */
export function startCleanupJob(db: Db, retentionDays: number, log: FastifyBaseLogger): () => void {
  const run = async () => {
    try {
      const deleted = await deleteInactiveBoards(db, retentionDays)
      if (deleted > 0) log.info({ deleted }, 'deleted inactive boards')
    } catch (err) {
      log.error({ err }, 'board cleanup failed')
    }
  }
  void run()
  const timer = setInterval(run, SIX_HOURS)
  timer.unref()
  return () => clearInterval(timer)
}
