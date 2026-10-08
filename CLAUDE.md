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

- **Phases 0 (Foundation), 1 (Users and roles) and 2 (Question bank) are implemented.** Next up: Phase 3 (execution core: queue, worker, sandbox). Follow the delivery order in `PROJECT_SCOPE.md`; do not skip ahead.
- The web UI is bilingual: English and Persian (Farsi, right to left) through next-intl; see "Internationalization" below.
- Not built yet: worker, queue, sandbox, engine, games, viewer, judge, quizzes. Their directories do not exist yet.
- Prisma schema has the Better Auth tables (`User`, `Session`, `Account`, `Verification`) and the question bank (`Question`, `TestCase`, enums `Difficulty`, `ComparisonRule`). The migrations `20261006000000_users_and_auth` and `20261006100000_question_bank` were written by hand (no `prisma migrate dev` was available); both were applied to a real Postgres 16 with `psql` and exercised by the store tests, but if `pnpm db:migrate` reports drift against `schema.prisma`, regenerate them.
- Question bank (Phase 2): admin-only API under `/questions` (CRUD, `POST /questions/preview`, `GET /questions/:id/student-view`, tests under `/questions/:id/tests`) and admin pages under `/admin/questions` (list, editor with live preview and test case editor, student preview), built with the shadcn conventions below. Quiz-side question settings (`QuizQuestion`, scoring penalty, minimum score) arrive in Phase 4.
- Auth: Better Auth in the API (username plugin + admin plugin). The first admin is created on API startup from `ADMIN_USERNAME` / `ADMIN_PASSWORD` when no admin exists. The status route is admin-only (`/admin/status` in the web app).

## Layout

```
apps/
  api/        Hono API. src/app.ts exports createApp() and AppType; src/index.ts starts the server.
              auth.ts (Better Auth factory), bootstrap.ts (first admin), middleware/ (request id,
              auth guards, rate limit), routes/ (status, me, users, client-logs, questions),
              questions/ (mdx.ts compiler + allowlist check, store.ts interface + in-memory store,
              prisma-store.ts)
  web/        Next.js App Router UI (Tailwind 4, shadcn/ui, TanStack Query, next-intl). UI only. Route group
              (app) holds every signed-in page (shell, guards); /login is public. components/ui = shadcn
              primitives, components/ = app components, lib/direction.ts = locales and text direction,
              i18n/ = next-intl setup (request config, locale cookie, language action), messages/ =
              en.json and fa.json (all UI text)
packages/
  db/         Prisma 7 schema and migrations, prisma.config.ts, client factory (createPrismaClient, pingDatabase)
  logger/     createLogger() (Pino + Seq stream, CLEF over HTTP)
  shared/     Zod schemas and constants shared by api and web (status, users and roles, client log limits, REQUEST_ID_HEADER,
              questions and test cases, the MDX allowlist)
compose.yaml / compose.dev.yaml / compose.prod.yaml, Caddyfile, .env.example
```

Workspace packages are consumed as TypeScript source (`exports` points at `src/index.ts`); there is no build step for them. The web app lists the ones it uses in `transpilePackages` in `next.config.ts`. `@bot-arena/api` exports `app.ts` so the web app can import `AppType` (type-only).

## Stack and versions

pnpm 10 workspaces, Turborepo, Node 22, TypeScript 6.x (pinned below 7 because typescript-eslint does not support 7 yet; revisit when it does), ESLint 10 flat config, Prettier, Vitest, Hono + `hc<AppType>` + `@hono/zod-validator`, Better Auth 1.7, Zod 4, Next.js 16, React 19, next-intl 4, Tailwind 4, shadcn/ui (Radix UI, lucide-react, Sonner, next-themes), TanStack Query, Pino 10, PostgreSQL 17, Seq, MDX (`@mdx-js/mdx` + `remark-gfm`, API only; the MDX pipeline from section 2).

## Commands

```bash
pnpm install                 # installs Husky hooks too
pnpm db:generate             # prisma generate (required before typecheck/build/dev)
pnpm dev | build | lint | typecheck | test
pnpm format | format:check
pnpm db:migrate              # prisma migrate dev
TEST_DATABASE_URL=postgresql://... pnpm --filter @bot-arena/api test   # also runs the Prisma store tests (skipped otherwise)
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
- **Questions and MDX:** `createApp()` takes a `QuestionStore` (`apps/api/src/questions/store.ts`); production passes `createPrismaQuestionStore(prisma)`, tests use `createMemoryQuestionStore()` (exposed by `makeTestApp` as `ctx.questions`). Keep both stores behaviour-compatible (`prisma-store.test.ts` runs the store against Postgres when `TEST_DATABASE_URL` is set). Statements are MDX compiled **at save time** by `compileStatement` (`questions/mdx.ts`, `function-body` output) and stored next to the source in `Question.statementCompiled`; a remark plugin rejects imports/exports, `{ }` expressions, unknown components or attributes and unsafe URL schemes. The allowlist lives in `@bot-arena/shared` (`MDX_COMPONENTS`, `MDX_HTML_TAGS`, `MDX_URL_PROTOCOLS`); `apps/web/src/components/mdx-components.tsx` maps the same names to React components (add a component in both places; it uses tokens and the shadcn `Table`). The web app evaluates the compiled code with the React JSX runtime in `mdx-content.tsx` (it does not bundle the MDX compiler). Hidden tests appear only in admin responses: the student view (`StudentQuestionView`) is built field by field from sample tests, and a test asserts it never contains hidden data. Test input and expected output are stored with `\n` line endings. Hono RPC responses include the validator's error shape, so in web code narrow with an inline `if (!res.ok) throw ...` before `res.json()` (a helper function does not narrow).
- **Client logs:** the browser logs only through `POST /client-logs` (authenticated, strict Zod schema from `@bot-arena/shared`, 64 KB body cap, 30 requests per user per minute, identity added server-side). The web side is `apps/web/src/lib/client-logger.ts` (window errors, unhandled rejections) plus the error boundaries `app/error.tsx` and `app/global-error.tsx`.
- **Web:** business logic stays in the API. The server checks the session with `getSessionUser()` (`apps/web/src/lib/session.ts`, forwards the cookie to `/me`); sign-in, sign-out and password change use the Better Auth client in `lib/auth-client.ts`. Browser calls go through `createApiClient()` in `apps/web/src/lib/api.ts`; server code uses `API_URL`, the browser uses `NEXT_PUBLIC_API_URL` (`/api` in production). Server-side logging uses `apps/web/src/lib/logger.ts` (`server-only`).
- **Env:** one root `.env` (copy of `.env.example`). The API loads it via `tsx --env-file-if-exists`; Prisma loads it in `prisma.config.ts` with dotenv; Next.js loads it in `next.config.ts` with `process.loadEnvFile` (Next itself only reads `apps/web/.env`). Auth variables: `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL` (API origin, no path), `ADMIN_USERNAME`, `ADMIN_PASSWORD`. When adding a variable, update `.env.example`, `apps/api/src/env.ts` (Zod) and the Compose files if needed.
- **Versioning:** one fixed product version across the root, `apps/api` and `apps/web` `package.json`; `packages/*` stay `0.0.0`. Change it only through `pnpm release`, never by hand. Only `vMAJOR.MINOR.PATCH` tags are releases (`tag_pattern` in `cliff.toml` and `SEMVER_TAG_RE` in `scripts/release.ts` must stay in sync). If a new app is added, add its `package.json` to `VERSIONED_PACKAGES` in `scripts/release.ts`. The root `package.json` is `"type": "module"` so `scripts/*.ts` run as ESM under `tsx`.
- **Dependencies:** do not add anything outside the stack in `PROJECT_SCOPE.md` section 2 without a written reason in the PR. `next-intl` (translations) and the UI dependencies (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `next-themes`, `tw-animate-css`, `@fontsource-variable/*`) belong to shadcn/ui and are part of the stack.

## UI (shadcn/ui, mandatory)

All web UI is built with **shadcn/ui** on Tailwind 4. Agents must follow these rules for any change under `apps/web`:

- **Use shadcn components first.** Before writing markup for a button, input, dialog, menu, table, select, toast, card, badge, alert, tabs, tooltip and so on, check `apps/web/src/components/ui/`. If the component is missing, add it the shadcn way (`pnpm dlx shadcn@latest add <name>` from `apps/web`; `components.json` is configured). If the CLI cannot reach the network, write the file by hand in the same shape: Radix primitive from `radix-ui`, `data-slot` attributes, `cn()` from `@/lib/utils`, `cva` for variants. Do not build custom modals, dropdowns or form controls, and do not use raw `<button>`, `<input>`, `<select>` or `<table>` for app UI.
- **Do not fork the primitives for one screen.** App-specific compositions live in `src/components/` (for example `ConfirmDialog`, `TextField`, `SelectField`, `TextareaField`, `CheckboxField`, `FormError`, `PageHeader`). Change `components/ui/*` only for changes that every screen should get.
- **Tokens, not colours.** Use semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`, `bg-signal`, ...), defined in `src/app/globals.css` and mapped through `@theme inline`. Never use raw palette classes (`bg-neutral-100`, `text-red-600`) or `dark:` colour overrides; dark mode is the `.dark` class (next-themes) and tokens flip by themselves. Change the look in `globals.css`.
- **RTL-ready by default (Persian is supported).** Use logical classes only: `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s`/`rounded-e`. Never `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`, `border-r`, `rounded-l`, `rounded-r`; ESLint (`no-restricted-syntax` in `eslint.config.mjs`) fails on them. Directional icons (chevrons, arrows) get `rtl:-scale-x-100`. Direction comes from one place, `lib/direction.ts`, and is applied as `dir` on `<html>` plus the Radix `Direction.Provider` in `app/providers.tsx`. Do not hardcode `left`/`right` in inline styles or SVG either.
- **Typography:** Archivo (variable, width axis) for Latin and Vazirmatn for Persian, both self-hosted through `@fontsource-variable/*` (no network at build time). Headings are wider and bolder through `font-stretch`; keep letter spacing at 0 for Persian.
- **Internationalization (next-intl, mandatory).** The UI ships in English (`en`, default) and Persian (`fa`, RTL). Every user-visible string lives in `apps/web/messages/<locale>.json`; never write UI text in a component. Rules:
  - **No locale in URLs.** The language comes from the `NEXT_LOCALE` cookie, then the browser's `Accept-Language`, then `en` (`src/i18n/request.ts`, `src/i18n/locale.ts`). The language menu (`components/locale-switcher.tsx`, also inside the account menu) calls the `setLocale` server action and refreshes the router. `app/layout.tsx` sets `<html lang dir>` from the locale; `global-error.tsx` has no server locale, so it reads the cookie in the browser and imports both message files.
  - **Using messages.** Server components: `await getTranslations('Namespace')` (a synchronous server component may call `useTranslations`). Client components: `useTranslations('Namespace')`. Page titles use `generateMetadata`, not a static `metadata` object. Keys are typed from `messages/en.json` (`src/i18n/global.d.ts`), so a wrong key fails `pnpm typecheck`. One namespace per screen or component; shared words live in `Common`, `Roles`, `Difficulty`, `Comparison`, `Nav`.
  - **Messages are ICU.** Pass values (`t('welcome', { name })`), never build sentences by concatenation. Use `{count, plural, one {# user} other {# users}}` for counts (Persian only needs `other`), `{n, number}` for numbers so Persian digits and separators follow the locale, and `useFormatter()` / `getFormatter()` for dates and times (Persian uses the Persian calendar). In ICU, `{ } < >` and a lone `'` before them are syntax: quote them (`'{ }'`) or pass the text as a value. Do not translate labels with a module-level constant; use a hook or build the list inside the component (see `useDifficultyOptions`, `useRoleOptions`).
  - **Adding or changing text:** add the key to `en.json` and `fa.json` in the same change. `messages/messages.test.ts` fails when the two files differ in keys or arguments, or when a message is not valid ICU. Keep the product name "Bot Arena" in Latin script in both languages (`App.name`).
  - **Adding a language:** add it to `LOCALES` (and `RTL_LOCALES` if right to left) and `LOCALE_NAMES` in `lib/direction.ts`, and add `messages/<locale>.json`. The language menu picks it up.
  - **Not translated (yet):** messages that come from the API or Better Auth (`{ error: string }` bodies, Zod messages in `@bot-arena/shared`) are shown as the server wrote them, in English. `useErrorMessage()` (`lib/use-error-message.ts`) shows them and supplies a translated fallback when there is none; sign-in and password-change failures use their own translated fallback. Question statements are admin-authored content and stay in whatever language the admin wrote. CHANGELOG.md is generated and stays English.
- **UX rules (apply to every screen):**
  - Anything destructive or session-ending (sign out, deactivate, delete, reset) asks first with `ConfirmDialog` (AlertDialog). The confirm button repeats the action's name ("Sign out", "Deactivate user"), never "OK"; Cancel is the default focus.
  - Every action gives feedback: a Sonner toast for success (same verb as the button: "Create user" then "User created"), an inline `FormError` in the form for failures. Buttons that run a request use `loading` and keep their label.
  - Loading states are skeletons, not bare "Loading…". Load errors show `FormError` plus a "Try again" button. Empty states say what to do next.
  - Do not offer actions the API will refuse (for example deactivating yourself).
  - Forms use `TextField` / `SelectField` (label, hint and error are wired for screen readers); keep native validation attributes. Status is never colour alone (badge text or icon too).
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
