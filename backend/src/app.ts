import { existsSync, readFileSync } from 'node:fs'
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

  // nginx-proxy forwards ACME HTTP-01 challenges here until the first cert exists.
  if (config.ACME_WEBROOT && existsSync(config.ACME_WEBROOT)) {
    await app.register(fastifyStatic, {
      root: path.join(config.ACME_WEBROOT, '.well-known', 'acme-challenge'),
      prefix: '/.well-known/acme-challenge/',
      decorateReply: false,
    })
  }

  const indexHtml = path.join(config.STATIC_DIR, 'index.html')
  if (existsSync(indexHtml)) {
    await app.register(fastifyStatic, { root: config.STATIC_DIR, wildcard: false })
    const boardHtml = withoutPreviewImage(readFileSync(indexHtml, 'utf8'))
    // Single-page app: every non-API route renders index.html.
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== 'GET' || request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'NOT_FOUND' })
      }
      // Boards are private links: keep them out of search engines, and leave out the preview
      // image so a shared board link doesn't post a big picture into Slack and co.
      if (request.url.startsWith('/b/')) {
        return reply
          .header('X-Robots-Tag', 'noindex, nofollow')
          .type('text/html; charset=utf-8')
          .send(boardHtml)
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

/** Removes the og:image and twitter:image tags and falls back to the small summary card. */
export function withoutPreviewImage(html: string): string {
  return html
    .replace(/<meta\s[^>]*(?:og:image|twitter:image)[^>]*>\s*/g, '')
    .replace('content="summary_large_image"', 'content="summary"')
}
