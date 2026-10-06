import { z } from 'zod'

/** Limits for browser logs (decision 37). The API enforces them; the browser logger respects them. */
export const CLIENT_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export const CLIENT_LOG_KINDS = [
  'manual',
  'window-error',
  'unhandled-rejection',
  'react-error-boundary',
] as const
export const CLIENT_LOG_MAX_EVENTS = 20
export const CLIENT_LOG_MAX_MESSAGE_BYTES = 2048
export const CLIENT_LOG_MAX_STACK_LENGTH = 4000
export const CLIENT_LOG_MAX_URL_LENGTH = 1000
/** Hard cap on the request body in bytes. */
export const CLIENT_LOG_MAX_BODY_BYTES = 64 * 1024

/** UTF-8 size of a string. Written by hand so this package needs neither DOM nor Node types. */
export function utf8ByteLength(value: string): number {
  let bytes = 0
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

/** Strict object: any field outside this allowlist is rejected, never logged. */
export const clientLogEventSchema = z
  .object({
    level: z.enum(CLIENT_LOG_LEVELS),
    message: z
      .string()
      .min(1)
      .refine((value) => utf8ByteLength(value) <= CLIENT_LOG_MAX_MESSAGE_BYTES, {
        message: `message must be at most ${CLIENT_LOG_MAX_MESSAGE_BYTES} bytes`,
      }),
    kind: z.enum(CLIENT_LOG_KINDS).default('manual'),
    url: z.string().max(CLIENT_LOG_MAX_URL_LENGTH).optional(),
    stack: z.string().max(CLIENT_LOG_MAX_STACK_LENGTH).optional(),
  })
  .strict()
export type ClientLogEvent = z.input<typeof clientLogEventSchema>

export const clientLogBatchSchema = z
  .object({
    events: z.array(clientLogEventSchema).min(1).max(CLIENT_LOG_MAX_EVENTS),
  })
  .strict()
export type ClientLogBatch = z.input<typeof clientLogBatchSchema>
