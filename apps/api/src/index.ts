import { createPrismaClient, pingDatabase } from '@bot-arena/db'
import { createLogger, resolveSeqUrl } from '@bot-arena/logger'
import { serve } from '@hono/node-server'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { createApp } from './app'
import { createAuth } from './auth'
import { ensureInitialAdmin } from './bootstrap'
import { loadEnv } from './env'
import { createPrismaQuestionStore } from './questions/prisma-store'

const env = loadEnv()

const seqUrl = resolveSeqUrl(process.env)

const logger = createLogger({
  service: 'api',
  level: env.LOG_LEVEL,
  seqUrl,
})

const prisma = createPrismaClient(env.DATABASE_URL)

const trustedOrigins = [env.WEB_ORIGIN, env.BETTER_AUTH_URL]
const auth = createAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  logger,
})

if (env.ADMIN_PASSWORD) {
  await ensureInitialAdmin(
    auth,
    { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD },
    logger,
  )
} else {
  logger.warn('ADMIN_PASSWORD is not set; no initial admin will be created')
}

const app = createApp({
  logger,
  auth,
  questions: createPrismaQuestionStore(prisma),
  status: { pingDatabase: () => pingDatabase(prisma), seqUrl },
  corsOrigin: env.NODE_ENV === 'production' ? undefined : env.WEB_ORIGIN,
})

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, 'api listening')
})

function shutdown(signal: string) {
  logger.info({ signal }, 'api shutting down')
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0))
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
