import { Hono } from 'hono'
import type { AppEnv } from '../types'

/** The current user. Must be mounted behind `requireAuth`. */
export function meRoutes() {
  return new Hono<AppEnv>().get('/', (c) => c.json({ user: c.get('user') }))
}
