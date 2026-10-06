import { zValidator } from '@hono/zod-validator'
import { CLIENT_LOG_MAX_BODY_BYTES, clientLogBatchSchema } from '@bot-arena/shared'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { rateLimit, type RateLimitOptions } from '../middleware/rate-limit'
import type { AppEnv } from '../types'

export type ClientLogsDeps = {
  /** Requests per user per window. Defaults to 30 per minute. */
  rateLimit?: Pick<RateLimitOptions, 'limit' | 'windowMs' | 'now'>
}

/**
 * Browser logs reach Seq only through here (decision 37). The route sits behind `requireAuth`;
 * it validates a strict schema, caps the body size, rate-limits per user, and adds identity
 * server-side. Clients cannot choose their own userId, service or requestId.
 */
export function clientLogRoutes(deps: ClientLogsDeps = {}) {
  return new Hono<AppEnv>().post(
    '/',
    bodyLimit({
      maxSize: CLIENT_LOG_MAX_BODY_BYTES,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    rateLimit({
      limit: deps.rateLimit?.limit ?? 30,
      windowMs: deps.rateLimit?.windowMs ?? 60_000,
      now: deps.rateLimit?.now,
    }),
    zValidator('json', clientLogBatchSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'Invalid log batch' }, 400)
    }),
    (c) => {
      const { events } = c.req.valid('json')
      const logger = c.get('logger').child({ source: 'client' })
      for (const event of events) {
        logger[event.level]({ kind: event.kind, url: event.url, stack: event.stack }, event.message)
      }
      return c.json({ accepted: events.length }, 202)
    },
  )
}
