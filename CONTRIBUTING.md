# Contributing

## Setup

Requirements: Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`), Docker with Compose.

```bash
pnpm install                      # also installs the Husky git hooks
cp .env.example .env              # then adjust values
docker compose -f compose.yaml -f compose.dev.yaml up -d   # Postgres and Seq
pnpm db:generate                  # generate the Prisma client
pnpm dev                          # web on :3000, API on :4000
```

- Seq UI: http://localhost:8087 by default (user `admin`, password `SEQ_ADMIN_PASSWORD` from `.env`).
- Seq host ports are set only in `.env` (`SEQ_INGESTION_PORT`, `SEQ_UI_PORT`). If a port is already taken, change it there and re-run `docker compose ... up -d`; the API and web server pick up the new ingestion port automatically after a restart.
- System status page: http://localhost:3000/status (open without login in development only).
- Services send logs to Seq without API keys: the ingestion port is reachable only from the internal Docker network (and from localhost in development). Filter by the `service` field in Seq.

Seq only applies `SEQ_ADMIN_PASSWORD` on its first run. To change it later, remove the `seq-data` volume.

## Branches and commits

- One feature per branch and per PR; keep PRs small and reviewable.
- Branch names: `feat/short-name`, `fix/short-name`, `chore/short-name`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) and are checked by commitlint, for example `feat(api): add status route`.
- The changelog is generated from commits with git-cliff (`pnpm changelog`). Do not edit `CHANGELOG.md` by hand.

## Building images behind a proxy

Production images are built with `docker compose -f compose.yaml -f compose.prod.yaml build`. If `pnpm install` or the Prisma engine download needs a proxy, set `BUILD_HTTP_PROXY`, `BUILD_HTTPS_PROXY` and (optionally) `BUILD_NO_PROXY` in `.env`. Leave them empty to download directly. A proxy running on your own machine must be addressed as `http://host.docker.internal:<port>`, not `localhost`. The values are used only at build time.

## Releases and versioning

The whole product has one version, kept in the root, `apps/api` and `apps/web` `package.json` files (`packages/*` stay at `0.0.0`). It is derived from Conventional Commits by git-cliff.

```bash
pnpm release --dry-run   # show the next version and the changelog entries, change nothing
pnpm release             # regenerate CHANGELOG.md, bump versions, commit "chore(release): vX.Y.Z" and tag
pnpm release --push      # same, then push the commit, the baseline tag and the new tag
```

- Only tags shaped exactly `vMAJOR.MINOR.PATCH` count as releases. Any other tag is ignored.
- The first run on a repository with no such tag creates a baseline tag `v<root version>` at `HEAD` and stops. Commits before that tag never appear in the changelog. To include earlier history, create the baseline on an older commit first: `git tag v0.0.0 <commit>`.
- Push the baseline tag (`git push origin v0.0.0`). `--push` does this for you. A clone without it would regenerate a shorter changelog.
- The working tree must be clean (`--allow-dirty` skips the check). The release commit goes through the normal Husky hooks.
- Version rules (git-cliff defaults): `feat` bumps minor, `fix` and the other types bump patch, a `!` or `BREAKING CHANGE:` bumps major.

## Git hooks

- `pre-commit`: lint-staged (Prettier and ESLint fix on staged files), then a type check on affected packages.
- `commit-msg`: commitlint.

A commit with a bad message or unformatted code is blocked. Do not bypass the hooks with `--no-verify`.

## Code rules

- Format with Prettier (shared config at the repo root): `pnpm format`.
- Services log only through `packages/logger`; no `console.log` in service code (ESLint enforces it).
- Keep game logic out of `apps/web`; the UI only renders and calls the API.
- Do not add dependencies outside the stack in the project scope without a written reason in the PR.

## Database (Prisma 7)

- The schema is `packages/db/prisma/schema.prisma`; the connection URL and migration path live in `packages/db/prisma.config.ts`, which reads `DATABASE_URL` from the root `.env`.
- The client is generated into `packages/db/src/generated` (git-ignored) and used through a `@prisma/adapter-pg` driver adapter. Run `pnpm db:generate` after pulling schema changes.
- Create a migration with `pnpm db:migrate`.

## Running tests

```bash
pnpm test        # Vitest across packages
pnpm lint
pnpm typecheck
pnpm format:check
```

## How to add a game

Games arrive in Phase 5 (game interface and engine). This section will be filled in then.

## PR checklist

- [ ] One feature, small diff
- [ ] Conventional Commit messages
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm format:check` pass
- [ ] Tests added for engine and sandbox changes
- [ ] No new dependency outside the stack, or the reason is written in the PR
- [ ] `.env.example` and docs updated if configuration changed
