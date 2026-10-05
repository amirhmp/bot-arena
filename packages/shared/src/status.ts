import { z } from 'zod'

export const serviceHealthSchema = z.object({
  status: z.enum(['ok', 'down']),
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
})
export type ServiceHealth = z.infer<typeof serviceHealthSchema>

export const systemStatusSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checkedAt: z.string(),
  services: z.object({
    api: serviceHealthSchema,
    database: serviceHealthSchema,
    seq: serviceHealthSchema,
  }),
})
export type SystemStatus = z.infer<typeof systemStatusSchema>

export const REQUEST_ID_HEADER = 'x-request-id'
