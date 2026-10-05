import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 no longer loads .env files by itself. The single .env lives at the repo root.
loadEnv({ path: path.join(import.meta.dirname, '../../.env'), quiet: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
