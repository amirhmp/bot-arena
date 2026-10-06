import { z } from 'zod'

export const ROLES = ['admin', 'player'] as const
export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** Logins are lowercase letters, digits, dots and underscores. Input is trimmed and lowercased. */
export const USERNAME_PATTERN = /^[a-z0-9_.]+$/
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(USERNAME_PATTERN, 'Use letters, digits, dots and underscores only')

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters')

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)

/** The signed-in user as the web app sees it. */
export const sessionUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  role: roleSchema,
})
export type SessionUser = z.infer<typeof sessionUserSchema>

/** A user row in the admin user list. */
export const userSummarySchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  role: roleSchema,
  active: z.boolean(),
  createdAt: z.string(),
})
export type UserSummary = z.infer<typeof userSummarySchema>

export const createUserSchema = z.object({
  username: usernameSchema,
  name: displayNameSchema,
  password: passwordSchema,
  role: roleSchema,
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z
  .object({
    username: usernameSchema.optional(),
    name: displayNameSchema.optional(),
    role: roleSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update')
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const setPasswordSchema = z.object({ password: passwordSchema })

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})
