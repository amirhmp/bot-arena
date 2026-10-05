import { createPrismaClient, pingDatabase } from '@bot-arena/db'
import { createLogger, resolveSeqUrl } from '@bot-arena/logger'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadEnv } from './env'

const env = loadEnv()

const seqUrl = resolveSeqUrl(process.env)

const logger = createLogger({
  service: 'api',
  level: env.LOG_LEVEL,
  seqUrl,
})

const prisma = createPrismaClient(env.DATABASE_URL)

const app = createApp({
  logger,
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
