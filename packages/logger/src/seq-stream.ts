import { Writable } from 'node:stream'

export type SeqStreamOptions = {
  /** Seq ingestion base URL, for example http://seq:5341 */
  url: string
  /** Flush when this many events are queued. */
  batchSize?: number
  /** Flush at least this often (ms). */
  flushIntervalMs?: number
  /** Called when shipping fails. Defaults to a silent drop, since logging must never crash a service. */
  onError?: (error: unknown) => void
}

const LEVELS: Record<number, string> = {
  10: 'Verbose',
  20: 'Debug',
  30: 'Information',
  40: 'Warning',
  50: 'Error',
  60: 'Fatal',
}

type PinoLine = Record<string, unknown> & {
  level?: number
  time?: number
  msg?: string
  err?: { message?: string; stack?: string }
}

/** Converts one Pino JSON line to a CLEF (compact log event format) object. */
export function toClef(line: PinoLine): Record<string, unknown> {
  const { level, time, msg, err, ...rest } = line
  const clef: Record<string, unknown> = {
    '@t': new Date(time ?? Date.now()).toISOString(),
    '@mt': msg ?? '',
    '@l': LEVELS[level ?? 30] ?? 'Information',
    ...rest,
  }
  if (err) {
    clef['@x'] = err.stack ?? err.message
  }
  return clef
}

/**
 * A Writable that receives Pino's JSON lines and ships them to Seq in batches
 * through the raw CLEF ingestion endpoint.
 */
export function createSeqStream(options: SeqStreamOptions): Writable & { flush(): Promise<void> } {
  const { url, batchSize = 50, flushIntervalMs = 1000, onError } = options
  const endpoint = `${url.replace(/\/$/, '')}/api/events/raw?clef`
  let queue: string[] = []
  let inFlight: Promise<void> = Promise.resolve()

  const send = async (events: string[]) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/vnd.serilog.clef',
        },
        body: events.join('\n'),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) {
        throw new Error(`Seq responded with ${response.status}`)
      }
    } catch (error) {
      onError?.(error)
    }
  }

  const flush = () => {
    if (queue.length === 0) return inFlight
    const events = queue
    queue = []
    inFlight = inFlight.then(() => send(events))
    return inFlight
  }

  const timer = setInterval(() => void flush(), flushIntervalMs)
  timer.unref()

  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      for (const raw of chunk.toString('utf8').split('\n')) {
        if (!raw.trim()) continue
        try {
          queue.push(JSON.stringify(toClef(JSON.parse(raw) as PinoLine)))
        } catch {
          // Not JSON: ship as a plain message.
          queue.push(JSON.stringify({ '@t': new Date().toISOString(), '@mt': raw }))
        }
      }
      if (queue.length >= batchSize) void flush()
      callback()
    },
    final(callback) {
      clearInterval(timer)
      flush().then(() => callback(), callback)
    },
  }) as Writable & { flush(): Promise<void> }
  stream.flush = flush
  return stream
}
