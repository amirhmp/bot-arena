import { zValidator } from '@hono/zod-validator'
import {
  createUserSchema,
  listUsersQuerySchema,
  roleSchema,
  setPasswordSchema,
  updateUserSchema,
  type UserSummary,
} from '@bot-arena/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { syntheticEmail, type Auth } from '../auth'
import type { AppEnv } from '../types'

const idParam = z.object({ id: z.string().min(1) })

type AuthUser = {
  id: string
  name: string
  username?: string | null
  role?: string | null
  banned?: boolean | null
  createdAt: Date | string
}

function toSummary(user: AuthUser): UserSummary {
  return {
    id: user.id,
    username: user.username ?? '',
    name: user.name,
    role: roleSchema.catch('player').parse(user.role),
    active: !user.banned,
    createdAt: new Date(user.createdAt).toISOString(),
  }
}

/**
 * Admin user management. Must be mounted behind `requireAuth` and `requireRole('admin')`.
 * The admin plugin of Better Auth does the work; these routes add our validation, the
 * username rules and the guards that keep the system from locking itself out.
 */
export function userRoutes(auth: Auth) {
  async function findByUsername(login: string) {
    const ctx = await auth.$context
    return ctx.adapter.findOne<{ id: string }>({
      model: 'user',
      where: [{ field: 'username', value: login }],
    })
  }

  async function countActiveAdmins(): Promise<number> {
    const ctx = await auth.$context
    return ctx.adapter.count({
      model: 'user',
      where: [
        { field: 'role', value: 'admin' },
        { field: 'banned', value: false },
      ],
    })
  }

  async function findUser(id: string): Promise<AuthUser | null> {
    const ctx = await auth.$context
    // The internal adapter is typed with the core fields only; the plugin fields are stored too.
    return (await ctx.internalAdapter.findUserById(id)) as AuthUser | null
  }

  return new Hono<AppEnv>()
    .get('/', zValidator('query', listUsersQuerySchema), async (c) => {
      const { limit, offset } = c.req.valid('query')
      const result = await auth.api.listUsers({
        headers: c.req.raw.headers,
        query: { limit, offset, sortBy: 'createdAt', sortDirection: 'desc' },
      })
      return c.json({
        users: result.users.map(toSummary),
        total: result.total,
      })
    })
    .post('/', zValidator('json', createUserSchema), async (c) => {
      const input = c.req.valid('json')
      if (await findByUsername(input.username)) {
        return c.json({ error: 'That username is already taken' }, 409)
      }
      const { user } = await auth.api.createUser({
        headers: c.req.raw.headers,
        body: {
          email: syntheticEmail(input.username),
          password: input.password,
          name: input.name,
          role: input.role,
          data: { username: input.username, emailVerified: true },
        },
      })
      c.get('logger').info(
        { targetUserId: user.id, username: input.username, role: input.role },
        'user created',
      )
      return c.json({ user: toSummary(user) }, 201)
    })
    .patch(
      '/:id',
      zValidator('param', idParam),
      zValidator('json', updateUserSchema),
      async (c) => {
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')
        const actor = c.get('user')
        const target = await findUser(id)
        if (!target) return c.json({ error: 'User not found' }, 404)

        if (input.role && input.role !== 'admin' && target.role === 'admin') {
          if (target.id === actor.id) {
            return c.json({ error: 'You cannot remove your own admin role' }, 400)
          }
          if ((await countActiveAdmins()) <= 1 && !target.banned) {
            return c.json({ error: 'At least one active admin is required' }, 400)
          }
        }
        if (input.username && input.username !== target.username) {
          if (await findByUsername(input.username)) {
            return c.json({ error: 'That username is already taken' }, 409)
          }
        }

        const data: Record<string, unknown> = {}
        if (input.name !== undefined) data.name = input.name
        if (input.username !== undefined) {
          data.username = input.username
          data.email = syntheticEmail(input.username)
        }
        if (Object.keys(data).length > 0) {
          await auth.api.adminUpdateUser({ headers: c.req.raw.headers, body: { userId: id, data } })
        }
        if (input.role && input.role !== target.role) {
          await auth.api.setRole({
            headers: c.req.raw.headers,
            body: { userId: id, role: input.role },
          })
        }

        const updated = await findUser(id)
        c.get('logger').info({ targetUserId: id, changes: Object.keys(input) }, 'user updated')
        return c.json({ user: toSummary(updated ?? target) })
      },
    )
    .post(
      '/:id/password',
      zValidator('param', idParam),
      zValidator('json', setPasswordSchema),
      async (c) => {
        const { id } = c.req.valid('param')
        const { password } = c.req.valid('json')
        if (!(await findUser(id))) return c.json({ error: 'User not found' }, 404)
        await auth.api.setUserPassword({
          headers: c.req.raw.headers,
          body: { userId: id, newPassword: password },
        })
        // A password reset ends the user's other sessions (never the admin's own).
        if (id !== c.get('user').id) {
          await auth.api.revokeUserSessions({ headers: c.req.raw.headers, body: { userId: id } })
        }
        c.get('logger').info({ targetUserId: id }, 'user password reset')
        return c.json({ ok: true as const })
      },
    )
    .post('/:id/deactivate', zValidator('param', idParam), async (c) => {
      const { id } = c.req.valid('param')
      if (id === c.get('user').id) return c.json({ error: 'You cannot deactivate yourself' }, 400)
      const target = await findUser(id)
      if (!target) return c.json({ error: 'User not found' }, 404)
      if (target.role === 'admin' && !target.banned && (await countActiveAdmins()) <= 1) {
        return c.json({ error: 'At least one active admin is required' }, 400)
      }
      // Banning also deletes the user's sessions, so they are signed out immediately.
      await auth.api.banUser({
        headers: c.req.raw.headers,
        body: { userId: id, banReason: 'Deactivated by an admin' },
      })
      c.get('logger').info({ targetUserId: id }, 'user deactivated')
      return c.json({ ok: true as const })
    })
    .post('/:id/activate', zValidator('param', idParam), async (c) => {
      const { id } = c.req.valid('param')
      if (!(await findUser(id))) return c.json({ error: 'User not found' }, 404)
      await auth.api.unbanUser({ headers: c.req.raw.headers, body: { userId: id } })
      c.get('logger').info({ targetUserId: id }, 'user activated')
      return c.json({ ok: true as const })
    })
}
