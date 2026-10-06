import type { Logger } from '@bot-arena/logger'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from '@bot-arena/shared'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { admin, username } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'

// Roles: `admin` can manage users; `player` has no admin permissions. All route-level access
// control is done by our own guards (middleware/auth.ts); this only declares the role names.
const ac = createAccessControl(defaultStatements)
const roles = { admin: ac.newRole(adminAc.statements), player: ac.newRole(userAc.statements) }

export const AUTH_BASE_PATH = '/auth'
/** Accounts have no real email address; Better Auth needs a unique one, so derive it from the login. */
export const SYNTHETIC_EMAIL_DOMAIN = 'users.invalid'

export type AuthOptions = {
  /** A Better Auth database adapter (Prisma in production, the memory adapter in tests). */
  database: BetterAuthOptions['database']
  secret: string
  /** Origin the API is reached on, without a path (the `/api` prefix is stripped by Caddy). */
  baseURL: string
  trustedOrigins: string[]
  logger: Logger
}

export function syntheticEmail(login: string): string {
  return `${login}@${SYNTHETIC_EMAIL_DOMAIN}`
}

/**
 * Better Auth with username/password sign-in and the admin plugin (roles, deactivation = ban).
 * Self-registration is off: users are created by admins through the user routes.
 */
export function createAuth(options: AuthOptions) {
  return betterAuth({
    appName: 'Bot Arena',
    baseURL: options.baseURL,
    basePath: AUTH_BASE_PATH,
    secret: options.secret,
    database: options.database,
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 32,
        usernameValidator: (value) => USERNAME_PATTERN.test(value.toLowerCase()),
      }),
      admin({ ac, roles, defaultRole: 'player', adminRoles: ['admin'] }),
    ],
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            options.logger.info({ userId: session.userId }, 'user signed in')
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
