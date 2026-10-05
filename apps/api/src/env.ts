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
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source)
}
