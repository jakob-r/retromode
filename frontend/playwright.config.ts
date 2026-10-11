import { defineConfig, devices } from '@playwright/test'

// Ports come from the single root .env
try {
  process.loadEnvFile('../.env')
} catch {
  // no .env: use defaults
}
const frontendPort = Number(process.env.FRONTEND_PORT || 5173)
const backendPort = Number(process.env.BACKEND_PORT || 3000)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${frontendPort}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Reuses running dev servers (e.g. from `make dev`), otherwise starts them. Needs Postgres up.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'pnpm --filter backend dev',
          url: `http://127.0.0.1:${backendPort}/api/health`,
          reuseExistingServer: true,
          cwd: '..',
        },
        {
          command: 'pnpm --filter frontend dev',
          url: `http://localhost:${frontendPort}`,
          reuseExistingServer: true,
          cwd: '..',
        },
      ],
})
