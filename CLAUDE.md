# CLAUDE.md

Guidance for AI coding agents working in this repository. The full product spec is `PROJECT_SCOPE.md` (delivery order, decisions, rules). This file describes what is actually implemented and the conventions to follow.

## Keeping this file current (mandatory)

Update this file in the same PR whenever an **architectural breaking change** happens, for example:

- a package or app is added, removed, renamed or moves responsibility
- a stack choice changes (framework, ORM, queue, logger, auth, test runner) or a major version is bumped
- how services talk to each other changes (API contract style, auth, ports, networks, env variables)
- build, dev or deploy flow changes (Compose files, Turborepo tasks, Dockerfiles, CI, git hooks)
- a convention below stops being true

Also update the "Current state" section when a phase from `PROJECT_SCOPE.md` section 6 is completed. Do not let this file describe things that no longer exist.

## Current state

- **Phase 0 (Foundation) is implemented.** Next up: Phase 1 (users and roles). Follow the delivery order in `PROJECT_SCOPE.md`; do not skip ahead.
- Not built yet: auth, users, worker, queue, sandbox, engine, games, viewer, judge. Their directories do not exist yet.
- Prisma schema has no models yet; Phase 1 adds `User`.
- The status route is open without login (development). Phase 1 moves it behind the admin role.

## Layout

```
apps/
  api/        Hono API. src/app.ts exports createApp() and AppType; src/index.ts starts the server
  web/        Next.js App Router UI (Tailwind 4, TanStack Query). UI only
packages/
  db/         Prisma 7 schema, prisma.config.ts, client factory (createPrismaClient, pingDatabase)
  logger/     createLogger() (Pino + Seq stream, CLEF over HTTP)
  shared/     Zod schemas and constants shared by api and web (status schema, REQUEST_ID_HEADER)
compose.yaml / compose.dev.yaml / compose.prod.yaml, Caddyfile, .env.example
```

Workspace packages are consumed as TypeScript source (`exports` points at `src/index.ts`); there is no build step for them. The web app lists the ones it uses in `transpilePackages` in `next.config.ts`. `@bot-arena/api` exports `app.ts` so the web app can import `AppType` (type-only).

## Stack and versions

pnpm 10 workspaces, Turborepo, Node 22, TypeScript 6.x (pinned below 7 because typescript-eslint does not support 7 yet; revisit when it does), ESLint 10 flat config, Prettier, Vitest, Hono + `hc<AppType>`, Zod 4, Next.js 16, React 19, Tailwind 4, TanStack Query, Pino 10, PostgreSQL 17, Seq.

## Commands

```bash
pnpm install                 # installs Husky hooks too
pnpm db:generate             # prisma generate (required before typecheck/build/dev)
pnpm dev | build | lint | typecheck | test
pnpm format | format:check
pnpm db:migrate              # prisma migrate dev
pnpm release [--dry-run|--push|--allow-dirty]   # version, CHANGELOG.md, commit + tag (scripts/release.ts)
pnpm typecheck:scripts       # typecheck scripts/ (not covered by turbo)
pnpm changelog               # manual git-cliff preview into CHANGELOG.md (never edit by hand)
docker compose -f compose.yaml -f compose.dev.yaml up -d   # Postgres + Seq for development
```

Turbo tasks `build`, `typecheck`, `lint`, `test` and `dev` depend on `generate`, so the Prisma client is generated first.

## Conventions

- **Commits:** Conventional Commits, enforced by commitlint (`commit-msg` hook). Pre-commit runs lint-staged (Prettier + ESLint fix) then `turbo run typecheck --affected`. Never bypass with `--no-verify`.
- **Formatting:** one Prettier config at the root (no semicolons, single quotes, width 100).
- **Imports:** `consistent-type-imports` is enforced; use `import type` for types.
- **Logging:** services log only through `@bot-arena/logger`; `no-console` is an ESLint error (allowed only in config files, `scripts/` and plain `.js`/`.mjs`/`.cjs` tooling files; services are TypeScript). Child loggers carry `requestId`, and later `userId`, `matchId`, `quizId`.
- **API:** routes are chained on the Hono app so types flow into `AppType`. Request validation uses Zod validators. Every request gets an `x-request-id` (reused if well-formed) and a bound `logger` in context (`c.get('logger')`). Dependencies such as the DB ping are injected into `createApp()` so routes are testable without a database.
- **Web typecheck:** `apps/web/next-env.d.ts` is generated and git-ignored; the web `typecheck` script runs `next typegen` first so a fresh clone or CI has the Next types.
- **Web:** business logic stays in the API. Browser calls go through `createApiClient()` in `apps/web/src/lib/api.ts`; server code uses `API_URL`, the browser uses `NEXT_PUBLIC_API_URL` (`/api` in production). Server-side logging uses `apps/web/src/lib/logger.ts` (`server-only`).
- **Env:** one root `.env` (copy of `.env.example`). The API loads it via `tsx --env-file-if-exists`; Prisma loads it in `prisma.config.ts` with dotenv; Next.js loads it in `next.config.ts` with `process.loadEnvFile` (Next itself only reads `apps/web/.env`). When adding a variable, update `.env.example`, `apps/api/src/env.ts` (Zod) and the Compose files if needed.
- **Versioning:** one fixed product version across the root, `apps/api` and `apps/web` `package.json`; `packages/*` stay `0.0.0`. Change it only through `pnpm release`, never by hand. Only `vMAJOR.MINOR.PATCH` tags are releases (`tag_pattern` in `cliff.toml` and `SEMVER_TAG_RE` in `scripts/release.ts` must stay in sync). If a new app is added, add its `package.json` to `VERSIONED_PACKAGES` in `scripts/release.ts`. The root `package.json` is `"type": "module"` so `scripts/*.ts` run as ESM under `tsx`.
- **Dependencies:** do not add anything outside the stack in `PROJECT_SCOPE.md` section 2 without a written reason in the PR.

## Prisma 7 specifics

- Connection URL and migrations path live in `packages/db/prisma.config.ts`, not in `schema.prisma` (the datasource block has no `url`).
- Prisma 7 does not read `.env` itself; `prisma.config.ts` loads the root `.env`.
- Generator is `prisma-client`, output `packages/db/src/generated` (git-ignored). Import the client only through `@bot-arena/db`.
- The client needs the `@prisma/adapter-pg` driver adapter; always create it with `createPrismaClient()`.
- `prisma generate` downloads engine binaries from `binaries.prisma.sh`; it fails in networks that block that host.

## Infrastructure

- **Dev:** Postgres and Seq run in Compose, published on localhost (Postgres 5432; Seq ingestion and UI ports come from `SEQ_INGESTION_PORT` / `SEQ_UI_PORT` in `.env`, defaults 5341 and 8087). Never hardcode those ports elsewhere: `compose.dev.yaml` interpolates them and code gets the URL from `resolveSeqUrl()` in `@bot-arena/logger` (`SEQ_URL` overrides; production Compose sets it to `http://seq:5341`). Web (3000) and API (4000) run on the host with hot reload. The API enables CORS for `WEB_ORIGIN` outside production.
- **Prod:** `compose.prod.yaml` adds Caddy, web and api on two networks: `edge` (Caddy, web, api, Seq UI) and `internal` (Postgres, Seq ingestion, and later the worker). Only Caddy publishes ports. Caddy serves `/` -> web and `/api` -> Hono on one domain (no CORS) and Seq's UI on its own subdomain, refusing ingestion paths.
- **Logging:** services send CLEF events to Seq's ingestion endpoint over the internal network without API keys (the ingestion port is never reachable from outside; do not add keys back without updating this file and decision 36). Seq's admin password comes from `SEQ_ADMIN_PASSWORD` and only applies on Seq's first run.
- **Docker builds:** build context is the repo root. Dockerfiles start with `# syntax=docker/dockerfile:1`, copy the lockfile and every workspace member's `package.json` first (so the install layer is only invalidated by manifest changes; **add a new package's `package.json` to both Dockerfiles**), run `pnpm install` with `--mount=type=cache,id=pnpm-store,target=/pnpm/store --store-dir /pnpm/store` (a `pnpm release` bumps versions in `package.json`, and the cache makes that reinstall a re-link, not a download), then `COPY . .` and `prisma generate` (with a placeholder `DATABASE_URL`). Optional build-time proxy: `BUILD_HTTP_PROXY` / `BUILD_HTTPS_PROXY` / `BUILD_NO_PROXY` in `.env` -> compose build args (`x-build-proxy` anchor in `compose.prod.yaml`) -> `ARG HTTP_PROXY/HTTPS_PROXY/NO_PROXY` (default empty) in the Dockerfiles; empty ones are unset in the `RUN` so no proxy means a direct download. Put any new network-using build step behind the same guard. `.dockerignore` keeps `.env`, `node_modules`, `.git` and most `*.md` out of the context (it must keep excluding `node_modules`, or `COPY . .` would overwrite the installed ones); update it when adding top-level files that must be in the image.
- **CI:** `.github/workflows/ci.yml` runs commitlint (PRs), format check, lint, typecheck, test and build.

## Rules from the project scope (summary)

Follow the delivery order; one feature per branch and PR; engine and sandbox features need unit tests; keep game logic out of `apps/web`; hidden test cases never leave the server; generated bot API files are never edited by hand; every new renderer passes the shared contract test.
