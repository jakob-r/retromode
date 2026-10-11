# --- Build: install the workspace, build frontend + backend, collect prod deps
FROM node:22-alpine AS build
RUN npm install -g pnpm@10.30.3
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile

COPY . .
# Operator contact for the legal pages; rendered into text-free images at build time.
ARG CONTACT_EMAIL=
ARG ADDRESS=
RUN pnpm build \
  && pnpm --filter backend deploy --prod --legacy /app \
  && cp -r backend/dist backend/drizzle /app/ \
  && cp -r frontend/dist /app/public

# --- Runtime: one Node process serving API, WebSocket and the built frontend
FROM node:22-alpine
ENV NODE_ENV=production \
    STATIC_DIR=/app/public \
    BACKEND_PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${BACKEND_PORT}/api/health" || exit 1
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
