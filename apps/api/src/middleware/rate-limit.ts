import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'

export type RateLimitOptions = {
  /** Requests allowed per window per key. */
  limit: number
  windowMs: number
  /** Which bucket a request belongs to. Defaults to the signed-in user, else 'anonymous'. */
  key?: (c: Context<AppEnv>) => string
  now?: () => number
}

/**
 * Fixed-window, in-memory rate limiter. Enough for a single API process (one VM, decision 23);
 * Phase 8 revisits rate limits platform-wide.
 */
export function rateLimit(options: RateLimitOptions) {
  const now = options.now ?? Date.now
  const buckets = new Map<string, { windowStart: number; count: number }>()

  return createMiddleware<AppEnv>(async (c, next) => {
    const key = options.key ? options.key(c) : (c.get('user')?.id ?? 'anonymous')
    const time = now()

    // Drop expired buckets so the map cannot grow without bound.
    if (buckets.size > 1000) {
      for (const [k, bucket] of buckets) {
        if (time - bucket.windowStart >= options.windowMs) buckets.delete(k)
      }
    }

    let bucket = buckets.get(key)
    if (!bucket || time - bucket.windowStart >= options.windowMs) {
      bucket = { windowStart: time, count: 0 }
      buckets.set(key, bucket)
    }
    bucket.count += 1

    if (bucket.count > options.limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((bucket.windowStart + options.windowMs - time) / 1000),
      )
      c.header('retry-after', String(retryAfter))
      return c.json({ error: 'Too many requests' }, 429)
    }
    await next()
  })
}
