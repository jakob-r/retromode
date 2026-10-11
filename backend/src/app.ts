import { existsSync } from 'node:fs'
import path from 'node:path'
import Fastify, { LogController, type FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import type { Server } from 'socket.io'
import type { Config } from './config'
import type { Db } from './db/client'
import { registerApiRoutes } from './http/routes'
import { createRealtimeServer } from './realtime/server'

export interface App {
  app: FastifyInstance
  io: Server
}

export async function buildApp(config: Config, db: Db): Promise<App> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' && {
        transport: { target: 'pino-pretty', options: { ignore: 'pid,hostname' } },
      }),
    },
    trustProxy: true,
    logController: new LogController({ disableRequestLogging: true }),
  })

  await app.register(rateLimit, { global: false })
  await registerApiRoutes(app, db)

  const indexHtml = path.join(config.STATIC_DIR, 'index.html')
  if (existsSync(indexHtml)) {
    await app.register(fastifyStatic, { root: config.STATIC_DIR, wildcard: false })
    // Single-page app: every non-API route renders index.html.
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== 'GET' || request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'NOT_FOUND' })
      }
      return reply.sendFile('index.html')
    })
  }

  const io = createRealtimeServer(app.server, db, app.log)
  app.addHook('onClose', async () => {
    await io.close()
  })
  return { app, io }
}
