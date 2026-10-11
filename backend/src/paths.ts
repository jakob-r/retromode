import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Nearest ancestor of this file (src/ in dev, dist/ when bundled) containing `marker`. */
function findUp(marker: string): string | undefined {
  let dir = here
  for (;;) {
    if (existsSync(path.join(dir, marker))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/** The monorepo root (absent in the Docker image, where config comes from the environment). */
export const repoRoot = findUp('pnpm-workspace.yaml')

/** backend/ (or the app folder in the Docker image) */
export const backendRoot = findUp(path.join('drizzle', 'meta', '_journal.json')) ?? process.cwd()

export const migrationsFolder = path.join(backendRoot, 'drizzle')
