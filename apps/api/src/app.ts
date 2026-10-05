import type { Logger } from '@bot-arena/logger'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from './middleware/request-id'
import { statusRoutes, type StatusDeps } from './routes/status'
import type { AppEnv } from './types'

export type AppOptions = {
  logger: Logger
  status: StatusDeps
  /** Set in development so the browser on another origin can call the API. Production uses one domain. */
  corsOrigin?: string
}

export function createApp(options: AppOptions) {
  const app = new Hono<AppEnv>()

  app.use(requestId(options.logger))
  if (options.corsOrigin) {
    app.use(cors({ origin: options.corsOrigin, credentials: true }))
  }

  app.onError((error, c) => {
    c.get('logger').error({ err: error }, 'unhandled error')
    return c.json({ error: 'Internal Server Error', requestId: c.get('requestId') }, 500)
  })

  // Chained so the route types flow into AppType for the Hono RPC client.
  return app
    .get('/health', (c) => c.json({ ok: true as const }))
    .route('/status', statusRoutes(options.status))
}

export type AppType = ReturnType<typeof createApp>
