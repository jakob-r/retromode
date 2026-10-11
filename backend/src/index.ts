import { buildApp } from './app'
import { loadConfig } from './config'
import { createDb } from './db/client'
import { startCleanupJob } from './jobs/cleanup'

const config = loadConfig()
const { db, pool } = createDb(config.DATABASE_URL)
const { app } = await buildApp(config, db)
const stopCleanup = startCleanupJob(db, config.BOARD_RETENTION_DAYS, app.log)

await app.listen({ port: config.BACKEND_PORT, host: '0.0.0.0' })

let shuttingDown = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (shuttingDown) return
    shuttingDown = true
    app.log.info(`${signal} received, shutting down`)
    stopCleanup()
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
