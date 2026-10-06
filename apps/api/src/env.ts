import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().default('info'),
  SEQ_URL: z.string().optional(),
  SEQ_INGESTION_PORT: z.coerce.number().int().positive().optional(),
  /** Origin allowed to call the API from a browser in development (no CORS in production). */
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  /** Signs session cookies. At least 32 characters; generate with `openssl rand -base64 32`. */
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  /** Origin the API is reached on, no path. Development: the API itself. Production: https://DOMAIN. */
  BETTER_AUTH_URL: z.string().default('http://localhost:4000'),
  /** First admin, created on startup when no admin exists. There is no self-registration. */
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source)
}
