import pg from 'pg'
import { loadConfig } from '../config'
import { runMigrations } from '../db/migrate'

/** Creates the test database if needed and migrates it. */
export default async function setup() {
  const url = testDatabaseUrl()
  const target = new URL(url)
  const dbName = target.pathname.slice(1)
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const client = new pg.Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [
      dbName,
    ])
    if (!rowCount) await client.query(`create database "${dbName.replaceAll('"', '')}"`)
  } finally {
    await client.end()
  }
  await runMigrations(url)
}

export function testDatabaseUrl(): string {
  const config = loadConfig()
  if (!config.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set (see .env.example)')
  return config.TEST_DATABASE_URL
}
