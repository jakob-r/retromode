# retromo.de ✨

**Free, open source retro boards for teams. No login, hosted in Germany.**

👉 **Try it at [retromo.de](https://retromo.de)**

[![Live at retromo.de](https://img.shields.io/badge/live-retromo.de-8B5CF6)](https://retromo.de)
[![License: MIT](https://img.shields.io/badge/license-MIT-3DDC97)](LICENSE)
[![Hosted in Germany](https://img.shields.io/badge/hosted%20in-Germany%20🇩🇪-FFD23F)](https://retromo.de)
[![CI](https://github.com/jakob-r/retromode/actions/workflows/ci.yml/badge.svg)](https://github.com/jakob-r/retromode/actions/workflows/ci.yml)

[retromo.de](https://retromo.de) is a fast, friendly retrospective board for agile, Scrum and remote teams. Create a board, share the link, and everyone can add items, merge them and vote, live and without logging in.

## Why retromo.de?

- 💛 **Free and open source**: no paid plans, no ads, MIT licensed
- 🔗 **No login**: no account, no sign-up, no email. The link is all you need
- 🇩🇪 **Hosted in Germany**: runs on servers in the EU
- ⚡ **Live for everyone**: every change shows up for the whole team right away
- 🥷 **Anonymous if you like**: post each item with your nickname or anonymously
- 🧹 **Nothing piles up**: boards without activity are deleted automatically
- 🐳 **Self-hostable**: one Docker image plus PostgreSQL

## Features

- Three columns: **What went well**, **To improve**, **Action items**
- Drag and drop to sort and move items, or drop one onto another to merge them into a group
- Dot voting with several votes per item, and taking your votes back
- Shared timer for timeboxed phases, optionally hiding everyone else's items until time is up
- Turn discussion points into linked action items
- The board owner can lock the board and moderate

## Use it

Just open **[retromo.de](https://retromo.de)**, click _Create retro board_ and share the link with your team. That's it.

## Development

See [CONCEPT.md](CONCEPT.md) for the full product and technical concept.

### Quick start

Requirements: Node 22+, pnpm 10, Docker (with `docker-compose`), make.

```bash
make dev
```

This creates `.env` from `.env.example`, starts Postgres in Docker, installs dependencies, runs migrations and starts backend and frontend. Then open http://localhost:5173 (or whatever `FRONTEND_PORT` is set to).

Want a board with content to play with? Run `make seed-demo` and open the printed link.

### Repository

| Path        | What                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `frontend/` | React 19 + Vite + Tailwind 4 + Motion + dnd-kit SPA                  |
| `backend/`  | Fastify + Socket.IO + Drizzle ORM on PostgreSQL                      |
| `shared/`   | Zod schemas, types, socket event maps and ordering helpers (FE + BE) |

All configuration and credentials live in **one root `.env`** (not checked in). `.env.example` documents every variable.

### Common tasks

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

### VPS deployment with Docker Compose

retromo.de runs as its own stack next to an existing [nginx-proxy](https://github.com/nginx-proxy/nginx-proxy) with acme-companion:

- `postgres`: PostgreSQL with a named volume, published only on `127.0.0.1`
- `app`: the production image; joins the proxy's Docker network and advertises `VIRTUAL_HOST`, so nginx-proxy routes the hostname (including WebSockets) and Let's Encrypt issues the cert. Until the first cert exists, the app serves ACME challenges from the companion's webroot volume.

Leave the proxy's Compose file alone and don't edit nginx by hand. DNS for `VIRTUAL_HOST` must already point at the VPS.

1. `cp .env.example .env`, then set a strong `POSTGRES_PASSWORD` (and the matching `DATABASE_URL`), and uncomment and fill in `VIRTUAL_HOST`, `LETSENCRYPT_HOST`, `LETSENCRYPT_EMAIL`, `PROXY_NETWORK` (`docker network ls | grep proxy`) and `PROXY_HTML_VOLUME` (`docker volume ls | grep html`).
2. Build and start:

   ```bash
   docker compose --profile app up -d --build
   ```

3. Check: `docker compose --profile app ps` and `docker compose --profile app logs -f app`. Migrations run on container start, so redeploying is `git pull` plus step 2.

## Contributing

Issues and pull requests are welcome. Run `make lint` and `make test` before opening a PR.

## License

[MIT](LICENSE). Made with ✨ for better retros. Use it for free at [retromo.de](https://retromo.de).
