import { sessionUserSchema, type Role, type SessionUser } from '@bot-arena/shared'
import { createMiddleware } from 'hono/factory'
import type { Auth } from '../auth'
import type { AppEnv } from '../types'

/** Reads the session from the cookie. Returns null for no session, a deactivated or unknown user. */
export async function getSessionUser(auth: Auth, headers: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers })
  if (!session) return null
  const user = session.user
  if (user.banned) return null
  const parsed = sessionUserSchema.safeParse({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  })
  return parsed.success ? parsed.data : null
}

/** Requires a valid session. Binds the user to the context and to the request logger. */
export function requireAuth(auth: Auth) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = await getSessionUser(auth, c.req.raw.headers)
    if (!user) return c.json({ error: 'Not signed in' }, 401)
    c.set('user', user)
    c.set('logger', c.get('logger').child({ userId: user.id }))
    await next()
  })
}

/** Requires one of the given roles. Use after `requireAuth`. */
export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get('user').role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  })
}
