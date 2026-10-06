import type { Logger } from '@bot-arena/logger'
import { APIError } from 'better-auth/api'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Auth } from './auth'
import { requireAuth, requireRole } from './middleware/auth'
import { requestId } from './middleware/request-id'
import { clientLogRoutes, type ClientLogsDeps } from './routes/client-logs'
import { meRoutes } from './routes/me'
import { statusRoutes, type StatusDeps } from './routes/status'
import { userRoutes } from './routes/users'
import type { AppEnv } from './types'

export type AppOptions = {
  logger: Logger
  auth: Auth
  status: StatusDeps
  clientLogs?: ClientLogsDeps
  /** Set in development so the browser on another origin can call the API. Production uses one domain. */
  corsOrigin?: string
}

export function createApp(options: AppOptions) {
  const { auth } = options
  const app = new Hono<AppEnv>()
  const signedIn = requireAuth(auth)
  const adminOnly = requireRole('admin')

  app.use(requestId(options.logger))
  if (options.corsOrigin) {
    app.use(cors({ origin: options.corsOrigin, credentials: true }))
  }

  app.onError((error, c) => {
    // Errors thrown by Better Auth carry a status and a user-facing message.
    if (error instanceof APIError) {
      return c.json({ error: error.message }, error.statusCode as 400)
    }
    c.get('logger').error({ err: error }, 'unhandled error')
    return c.json({ error: 'Internal Server Error', requestId: c.get('requestId') }, 500)
  })

  // Role-based access control lives here, in one place: every route below is behind a guard.
  app.use('/me', signedIn)
  app.use('/client-logs', signedIn)
  app.use('/status', signedIn, adminOnly)
  app.use('/users', signedIn, adminOnly)
  app.use('/users/*', signedIn, adminOnly)

  // Chained so the route types flow into AppType for the Hono RPC client.
  return app
    .get('/health', (c) => c.json({ ok: true as const }))
    .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
    .route('/me', meRoutes())
    .route('/client-logs', clientLogRoutes(options.clientLogs))
    .route('/status', statusRoutes(options.status))
    .route('/users', userRoutes(auth))
}

export type AppType = ReturnType<typeof createApp>
