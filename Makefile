.PHONY: dev install postgres wait-postgres migrate db-generate db-reset seed-demo run frontend-dev \
	test e2e lint format typecheck build docker-up docker-down

DOCKER_COMPOSE ?= docker-compose

# Load the root .env (if present) so targets can use POSTGRES_* etc.
-include .env
export

POSTGRES_USER ?= retromode
POSTGRES_DB ?= retromode

dev:
	test -f .env || cp .env.example .env
	$(MAKE) postgres
	$(MAKE) wait-postgres
	pnpm install
	$(MAKE) migrate
	@echo "Backend: http://localhost:$${BACKEND_PORT:-3000}  Frontend: http://localhost:$${FRONTEND_PORT:-5173}  (Ctrl+C to stop)"
	@trap 'kill 0' INT TERM; \
	(pnpm --filter backend dev) & \
	(pnpm --filter frontend dev) & \
	wait

install:
	pnpm install

postgres:
	$(DOCKER_COMPOSE) up -d postgres

wait-postgres:
	@echo "Waiting for Postgres..."
	@for i in $$(seq 1 20); do \
		$(DOCKER_COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1 && \
		$(DOCKER_COMPOSE) port postgres 5432 >/dev/null 2>&1 && exit 0; \
		sleep 1; \
	done; \
	echo "Postgres did not become ready (is port $${POSTGRES_PORT:-5433} free?)"; exit 1

migrate:
	pnpm --filter backend db:migrate

db-generate:
	pnpm --filter backend db:generate

db-reset:
	$(DOCKER_COMPOSE) exec -T postgres psql -U $(POSTGRES_USER) -d postgres -c "DROP DATABASE IF EXISTS $(POSTGRES_DB) WITH (FORCE);" -c "CREATE DATABASE $(POSTGRES_DB);"
	$(MAKE) migrate

seed-demo:
	pnpm --filter backend db:seed-demo

run:
	pnpm --filter backend dev

frontend-dev:
	pnpm --filter frontend dev

test:
	pnpm -r test

e2e:
	pnpm --filter frontend e2e

lint:
	pnpm lint

typecheck:
	pnpm typecheck

format:
	pnpm format

build:
	pnpm build

docker-up:
	$(DOCKER_COMPOSE) --profile app up -d --build

docker-down:
	$(DOCKER_COMPOSE) --profile app down
