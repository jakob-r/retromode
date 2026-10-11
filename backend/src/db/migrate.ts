import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { loadConfig } from '../config'
import { migrationsFolder } from '../paths'
import { createDb } from './client'

export async function runMigrations(url: string): Promise<void> {
  const { db, pool } = createDb(url)
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await pool.end()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = loadConfig()
  await runMigrations(config.DATABASE_URL)
  console.log('✔ Migrations applied')
}
