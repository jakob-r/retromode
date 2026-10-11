import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/db/migrate.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  clean: true,
  // The shared workspace package ships TypeScript sources, so bundle it in.
  noExternal: ['@retromode/shared'],
})
