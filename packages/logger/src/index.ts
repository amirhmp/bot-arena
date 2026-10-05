import pino, { type Logger } from 'pino'
import { createSeqStream } from './seq-stream'

export type { Logger }
export { createSeqStream, toClef } from './seq-stream'

export type ServiceName = 'api' | 'worker' | 'web'

/**
 * Single place that decides where Seq ingestion lives for a process.
 * `SEQ_URL` wins (production sets it to the internal address); otherwise the development
 * URL is built from `SEQ_INGESTION_PORT`, the same variable compose.dev.yaml publishes.
 */
export function resolveSeqUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (env.SEQ_URL) return env.SEQ_URL
  if (env.SEQ_INGESTION_PORT) return `http://localhost:${env.SEQ_INGESTION_PORT}`
  return undefined
}

export type CreateLoggerOptions = {
  service: ServiceName
  level?: string
  /** Seq ingestion URL. When missing, logs only go to stdout. */
  seqUrl?: string
}

/**
 * The only way services create a logger. Every event carries `service`;
 * callers add requestId, userId, matchId, quizId and so on through child loggers.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const level = options.level ?? 'info'
  // Pino's multistream entries want its Level union; the env value is validated by pino itself.
  const entryLevel = level as pino.Level
  const streams: pino.StreamEntry[] = [{ level: entryLevel, stream: process.stdout }]

  if (options.seqUrl) {
    streams.push({
      level: entryLevel,
      stream: createSeqStream({
        url: options.seqUrl,
        onError: (error) => {
          process.stderr.write(`[logger] could not ship logs to Seq: ${String(error)}\n`)
        },
      }),
    })
  }

  return pino({ level, base: { service: options.service } }, pino.multistream(streams))
}
