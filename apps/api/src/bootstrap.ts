import type { Logger } from '@bot-arena/logger'
import { syntheticEmail, type Auth } from './auth'

export type InitialAdmin = { username: string; password: string; name?: string }

/**
 * There is no self-registration, so the first admin comes from the environment.
 * Creates the account only when no admin exists yet; later restarts do nothing.
 * Returns true when an account was created.
 */
export async function ensureInitialAdmin(
  auth: Auth,
  initial: InitialAdmin,
  logger: Logger,
): Promise<boolean> {
  const ctx = await auth.$context
  const existing = await ctx.adapter.findOne<{ id: string }>({
    model: 'user',
    where: [{ field: 'role', value: 'admin' }],
  })
  if (existing) return false

  const login = initial.username.trim().toLowerCase()
  const user = await ctx.internalAdapter.createUser(
    {
      name: initial.name ?? 'Administrator',
      email: syntheticEmail(login),
      emailVerified: true,
      username: login,
      role: 'admin',
    },
    { method: 'admin' },
  )
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: await ctx.password.hash(initial.password),
  })
  logger.info({ userId: user.id, username: login }, 'initial admin created')
  return true
}
