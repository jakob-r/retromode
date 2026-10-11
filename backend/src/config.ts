import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'
import { repoRoot } from './paths'

// One .env in the repo root for all packages. In Docker the variables come
// from the environment instead and there is no repo root.
if (repoRoot) dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true })

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().optional(),
  BACKEND_PORT: z.coerce.number().int().positive().default(3000),
  BOARD_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Built frontend to serve (only if it contains an index.html) */
  STATIC_DIR: z.string().default(path.join(repoRoot ?? process.cwd(), 'frontend', 'dist')),
  /** acme-companion webroot, served under /.well-known/acme-challenge/ (production behind nginx-proxy) */
  ACME_WEBROOT: z.string().optional(),
})

export type Config = z.infer<typeof configSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid configuration (check the root .env):\n${issues.join('\n')}`)
  }
  return parsed.data
}
