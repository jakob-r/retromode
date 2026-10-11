# retromo.de ✨

Fast, friendly retro boards for teams. Create a board, share the link, and everyone can add items, merge them and vote, live and without logging in.

See [CONCEPT.md](CONCEPT.md) for the full product and technical concept.

## Quick start

Requirements: Node 22+, pnpm 10, Docker (with `docker-compose`), make.

```bash
make dev
```

This creates `.env` from `.env.example`, starts Postgres in Docker, installs dependencies, runs migrations and starts backend and frontend. Then open http://localhost:5173 (or whatever `FRONTEND_PORT` is set to).

Want a board with content to play with? Run `make seed-demo` and open the printed link.

## Repository

| Path        | What                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `frontend/` | React 19 + Vite + Tailwind 4 + Motion + dnd-kit SPA                  |
| `backend/`  | Fastify + Socket.IO + Drizzle ORM on PostgreSQL                      |
| `shared/`   | Zod schemas, types, socket event maps and ordering helpers (FE + BE) |

All configuration and credentials live in **one root `.env`** (not checked in). `.env.example` documents every variable.

## Common tasks

| Command                          | What it does                                                 |
| -------------------------------- | ------------------------------------------------------------ |
| `make dev`                       | Full local setup + backend and frontend dev servers          |
| `make test`                      | Unit and integration tests (needs Postgres: `make postgres`) |
| `make e2e`                       | Playwright test with two people collaborating in real time   |
| `make lint` / `make format`      | ESLint, Prettier and TypeScript checks / auto-format         |
| `make migrate`                   | Apply database migrations                                    |
| `make db-generate`               | Create a migration after changing `backend/src/db/schema.ts` |
| `make db-reset`                  | Drop and recreate the dev database                           |
| `make seed-demo`                 | Create a demo board                                          |
| `make build`                     | Production build of frontend and backend                     |
| `make docker-up` / `docker-down` | Run the production image together with Postgres              |

The first `make e2e` run needs a browser: `pnpm --filter frontend exec playwright install chromium`.

## Production

The root `Dockerfile` builds one image. Fastify serves the API, the WebSocket and the built frontend on `BACKEND_PORT`, and migrations run on container start. `docker-compose.yml` has the `app` service behind the `app` profile:

```bash
make docker-up
```
