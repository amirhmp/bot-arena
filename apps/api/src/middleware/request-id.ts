import { randomUUID } from 'node:crypto'
import { REQUEST_ID_HEADER } from '@bot-arena/shared'
import type { Logger } from '@bot-arena/logger'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/

/**
 * Gives every request an id (reusing a well-formed incoming one), exposes it on the response,
 * binds a child logger carrying it, and logs one line per finished request.
 */
export function requestId(rootLogger: Logger) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const incoming = c.req.header(REQUEST_ID_HEADER)
    const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID()
    const logger = rootLogger.child({ requestId: id })

    c.set('requestId', id)
    c.set('logger', logger)
    c.header(REQUEST_ID_HEADER, id)

    const started = performance.now()
    await next()

    // Read the logger back from the context: auth middleware may have bound a userId to it.
    c.get('logger').info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - started),
      },
      'request completed',
    )
  })
}
