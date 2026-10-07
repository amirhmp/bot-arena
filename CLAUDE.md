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

- **Phase 0 (Foundation) and Phase 1 (Users and roles) are implemented.** Next up: Phase 2 (question bank). Follow the delivery order in `PROJECT_SCOPE.md`; do not skip ahead.
- Not built yet: worker, queue, sandbox, engine, games, viewer, judge, questions, quizzes. Their directories do not exist yet.
- Prisma schema has the Better Auth tables (`User`, `Session`, `Account`, `Verification`). The migration `20261006000000_users_and_auth` was written by hand (no database was available to run `prisma migrate dev`); if `pnpm db:migrate` reports drift against `schema.prisma`, regenerate it.
- Auth: Better Auth in the API (username plugin + admin plugin). The first admin is created on API startup from `ADMIN_USERNAME` / `ADMIN_PASSWORD` when no admin exists. The status route is admin-only (`/admin/status` in the web app).

## Layout

```
apps/
  api/        Hono API. src/app.ts exports createApp() and AppType; src/index.ts starts the server.
              auth.ts (Better Auth factory), bootstrap.ts (first admin), middleware/ (request id,
              auth guards, rate limit), routes/ (status, me, users, client-logs)
  web/        Next.js App Router UI (Tailwind 4, shadcn/ui, TanStack Query). UI only. Route group (app)
              holds every signed-in page (shell, guards); /login is public. components/ui = shadcn
              primitives, components/ = app components, lib/direction.ts = text direction
packages/
  db/         Prisma 7 schema and migrations, prisma.config.ts, client factory (createPrismaClient, pingDatabase)
  logger/     createLogger() (Pino + Seq stream, CLEF over HTTP)
  shared/     Zod schemas and constants shared by api and web (status, users and roles, client log limits, REQUEST_ID_HEADER)
compose.yaml / compose.dev.yaml / compose.prod.yaml, Caddyfile, .env.example
```

Workspace packages are consumed as TypeScript source (`exports` points at `src/index.ts`); there is no build step for them. The web app lists the ones it uses in `transpilePackages` in `next.config.ts`. `@bot-arena/api` exports `app.ts` so the web app can import `AppType` (type-only).

## Stack and versions

pnpm 10 workspaces, Turborepo, Node 22, TypeScript 6.x (pinned below 7 because typescript-eslint does not support 7 yet; revisit when it does), ESLint 10 flat config, Prettier, Vitest, Hono + `hc<AppType>` + `@hono/zod-validator`, Better Auth 1.7, Zod 4, Next.js 16, React 19, Tailwind 4, shadcn/ui (Radix UI, lucide-react, Sonner, next-themes), TanStack Query, Pino 10, PostgreSQL 17, Seq.

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
- **Auth and access control:** every route is guarded in one place, `createApp()` in `apps/api/src/app.ts` (`requireAuth`, then `requireRole('admin')` for admin routes). Routes read the user with `c.get('user')`; after `requireAuth` the context logger carries `userId`. Roles are `admin` and `player` (`ROLES` in `@bot-arena/shared`). Accounts have no real email: Better Auth gets a synthetic `<username>@users.invalid`. Deactivation is a Better Auth ban. Tests use Better Auth's memory adapter through `src/test-utils.ts` (`makeTestApp`), so no database is needed.
- **Client logs:** the browser logs only through `POST /client-logs` (authenticated, strict Zod schema from `@bot-arena/shared`, 64 KB body cap, 30 requests per user per minute, identity added server-side). The web side is `apps/web/src/lib/client-logger.ts` (window errors, unhandled rejections) plus the error boundaries `app/error.tsx` and `app/global-error.tsx`.
- **Web:** business logic stays in the API. The server checks the session with `getSessionUser()` (`apps/web/src/lib/session.ts`, forwards the cookie to `/me`); sign-in, sign-out and password change use the Better Auth client in `lib/auth-client.ts`. Browser calls go through `createApiClient()` in `apps/web/src/lib/api.ts`; server code uses `API_URL`, the browser uses `NEXT_PUBLIC_API_URL` (`/api` in production). Server-side logging uses `apps/web/src/lib/logger.ts` (`server-only`).
- **Env:** one root `.env` (copy of `.env.example`). The API loads it via `tsx --env-file-if-exists`; Prisma loads it in `prisma.config.ts` with dotenv; Next.js loads it in `next.config.ts` with `process.loadEnvFile` (Next itself only reads `apps/web/.env`). Auth variables: `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL` (API origin, no path), `ADMIN_USERNAME`, `ADMIN_PASSWORD`. When adding a variable, update `.env.example`, `apps/api/src/env.ts` (Zod) and the Compose files if needed.
- **Versioning:** one fixed product version across the root, `apps/api` and `apps/web` `package.json`; `packages/*` stay `0.0.0`. Change it only through `pnpm release`, never by hand. Only `vMAJOR.MINOR.PATCH` tags are releases (`tag_pattern` in `cliff.toml` and `SEMVER_TAG_RE` in `scripts/release.ts` must stay in sync). If a new app is added, add its `package.json` to `VERSIONED_PACKAGES` in `scripts/release.ts`. The root `package.json` is `"type": "module"` so `scripts/*.ts` run as ESM under `tsx`.
- **Dependencies:** do not add anything outside the stack in `PROJECT_SCOPE.md` section 2 without a written reason in the PR. UI dependencies (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `next-themes`, `tw-animate-css`, `@fontsource-variable/*`) belong to shadcn/ui and are part of the stack.

## UI (shadcn/ui, mandatory)

All web UI is built with **shadcn/ui** on Tailwind 4. Agents must follow these rules for any change under `apps/web`:

- **Use shadcn components first.** Before writing markup for a button, input, dialog, menu, table, select, toast, card, badge, alert, tabs, tooltip and so on, check `apps/web/src/components/ui/`. If the component is missing, add it the shadcn way (`pnpm dlx shadcn@latest add <name>` from `apps/web`; `components.json` is configured). If the CLI cannot reach the network, write the file by hand in the same shape: Radix primitive from `radix-ui`, `data-slot` attributes, `cn()` from `@/lib/utils`, `cva` for variants. Do not build custom modals, dropdowns or form controls, and do not use raw `<button>`, `<input>`, `<select>` or `<table>` for app UI.
- **Do not fork the primitives for one screen.** App-specific compositions live in `src/components/` (for example `ConfirmDialog`, `TextField`, `SelectField`, `FormError`, `PageHeader`). Change `components/ui/*` only for changes that every screen should get.
- **Tokens, not colors.** Use semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`, `bg-signal`, ...), defined in `src/app/globals.css` and mapped through `@theme inline`. Never use raw palette classes (`bg-neutral-100`, `text-red-600`) or `dark:` color overrides; dark mode is the `.dark` class (next-themes) and tokens flip by themselves. Change the look in `globals.css`.
- **RTL-ready by default (Persian is planned).** Use logical classes only: `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s`/`rounded-e`. Never `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`, `border-r`, `rounded-l`, `rounded-r`; ESLint (`no-restricted-syntax` in `eslint.config.mjs`) fails on them. Directional icons (chevrons, arrows) get `rtl:-scale-x-100`. Direction comes from one place, `lib/direction.ts`, and is applied as `dir` on `<html>` plus the Radix `Direction.Provider` in `app/providers.tsx`. Do not hardcode `left`/`right` in inline styles or SVG either. UI text is still hard-coded English; adding Persian also needs an i18n layer (not decided yet) and a locale switch in `app/layout.tsx`.
- **Typography:** Archivo (variable, width axis) for Latin and Vazirmatn for Persian, both self-hosted through `@fontsource-variable/*` (no network at build time). Headings are wider and bolder through `font-stretch`; keep letter spacing at 0 for Persian.
- **UX rules (apply to every screen):**
  - Anything destructive or session-ending (sign out, deactivate, delete, reset) asks first with `ConfirmDialog` (AlertDialog). The confirm button repeats the action's name ("Sign out", "Deactivate user"), never "OK"; Cancel is the default focus.
  - Every action gives feedback: a Sonner toast for success (same verb as the button: "Create user" then "User created"), an inline `FormError` in the form for failures. Buttons that run a request use `loading` and keep their label.
  - Loading states are skeletons, not bare "Loading…". Load errors show `FormError` plus a "Try again" button. Empty states say what to do next.
  - Do not offer actions the API will refuse (for example deactivating yourself).
  - Forms use `TextField` / `SelectField` (label, hint and error are wired for screen readers); keep native validation attributes. Status is never color alone (badge text or icon too).
  - Copy: sentence case, plain verbs, no apologies in errors, say what happened and what to do.
- **Quality floor:** visible keyboard focus, reduced motion respected (global rule in `globals.css`), works down to 360 px wide, no horizontal page scroll (wrap wide tables in the `Table` component, and use `grid-cols-1` on page grids so wide children cannot stretch the column).
- Visual direction for new screens (tournament field: chalk-white paper, pitch green, whistle-yellow signal for "you are here") is in `globals.css` and `components/bracket-art.tsx`; keep new screens consistent with it. Use the `frontend-design` skill when designing a new screen.

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
- **Migrations:** the API image runs `prisma migrate deploy` before starting (`apps/api/Dockerfile`).
- **CI:** `.github/workflows/ci.yml` runs commitlint (PRs), format check, lint, typecheck, test and build.

## Rules from the project scope (summary)

Follow the delivery order; one feature per branch and PR; engine and sandbox features need unit tests; keep game logic out of `apps/web`; hidden test cases never leave the server; generated bot API files are never edited by hand; every new renderer passes the shared contract test.
