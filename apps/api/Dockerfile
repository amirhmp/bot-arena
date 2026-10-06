# syntax=docker/dockerfile:1
# Build context is the REPO ROOT (compose.prod.yaml: `context: .`, `dockerfile: apps/api/Dockerfile`).
# pnpm needs to see the whole workspace (root manifests, lockfile and every member's package.json),
# not just apps/api.

FROM node:22-slim
RUN corepack enable
WORKDIR /repo

# Copy workspace manifests first so `pnpm install` is cached and only reruns when a package.json or
# the lockfile changes, not on every source edit. A `pnpm release` bumps versions in package.json,
# which does invalidate this layer; the cache mount below makes that reinstall fast.
# Add every new workspace member's package.json here.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Optional build-time proxy, filled from BUILD_*_PROXY in .env by compose.prod.yaml.
# Empty (the default) means no proxy: the packages are downloaded directly.
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG NO_PROXY=""

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    [ -n "$HTTP_PROXY" ] || unset HTTP_PROXY; \
    [ -n "$HTTPS_PROXY" ] || unset HTTPS_PROXY; \
    [ -n "$NO_PROXY" ] || unset NO_PROXY; \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter @bot-arena/api...

# Now bring in the rest of the source (.dockerignore keeps host node_modules and .env out).
COPY . .

# `prisma generate` downloads engine binaries, so it gets the proxy too. It never connects to a
# database, but prisma.config.ts reads DATABASE_URL, so give it a placeholder.
RUN [ -n "$HTTP_PROXY" ] || unset HTTP_PROXY; \
    [ -n "$HTTPS_PROXY" ] || unset HTTPS_PROXY; \
    [ -n "$NO_PROXY" ] || unset NO_PROXY; \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    pnpm --filter @bot-arena/db generate

ENV NODE_ENV=production
EXPOSE 4000
# Apply pending migrations, then start. Both need DATABASE_URL from the Compose environment.
CMD ["sh", "-c", "pnpm --filter @bot-arena/db migrate:deploy && pnpm --filter @bot-arena/api start"]
