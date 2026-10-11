import type { FastifyInstance } from 'fastify'
import { sql } from 'drizzle-orm'
import { createBoardSchema } from '@retromode/shared'
import type { Db } from '../db/client'
import { createBoard } from '../domain/boards'

export async function registerApiRoutes(app: FastifyInstance, db: Db): Promise<void> {
  app.get('/api/health', async () => {
    await db.execute(sql`select 1`)
    return { ok: true }
  })

  app.post(
    '/api/boards',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = createBoardSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.code(400).send({ error: 'INVALID', message: 'Invalid input' })
      return reply.code(201).send(await createBoard(db, parsed.data))
    },
  )
}
