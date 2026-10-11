import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// One .env in the repo root. Only VITE_* variables are exposed to the browser;
// the rest is read here for dev-server settings only.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '')
  const backend = `http://127.0.0.1:${env.BACKEND_PORT || 3000}`
  return {
    envDir: '..',
    plugins: [react(), tailwindcss()],
    test: { include: ['src/**/*.test.ts'] },
    server: {
      port: Number(env.FRONTEND_PORT || 5173),
      proxy: {
        '/api': backend,
        '/socket.io': { target: backend, ws: true },
      },
    },
  }
})
