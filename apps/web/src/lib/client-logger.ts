import {
  CLIENT_LOG_MAX_EVENTS,
  CLIENT_LOG_MAX_MESSAGE_BYTES,
  CLIENT_LOG_MAX_STACK_LENGTH,
  CLIENT_LOG_MAX_URL_LENGTH,
  type ClientLogEvent,
} from '@bot-arena/shared'
import { createApiClient } from './api'

type Kind = NonNullable<ClientLogEvent['kind']>

const FLUSH_DELAY_MS = 1000
/** The same message is sent at most once per window, so a render loop cannot flood the API. */
const DEDUPE_WINDOW_MS = 10_000

const queue: ClientLogEvent[] = []
let timer: ReturnType<typeof setTimeout> | undefined
const recent = new Map<string, number>()
let installed = false

/** Cuts a string to a byte budget (UTF-8) without splitting a character. */
function truncateBytes(value: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  if (encoder.encode(value).length <= maxBytes) return value
  let result = value.slice(0, maxBytes)
  while (encoder.encode(result).length > maxBytes) result = result.slice(0, -1)
  return result
}

async function flush() {
  timer = undefined
  const events = queue.splice(0, CLIENT_LOG_MAX_EVENTS)
  if (queue.length > 0) timer = setTimeout(flush, FLUSH_DELAY_MS)
  if (events.length === 0) return
  try {
    // Failures are dropped on purpose: reporting a logging failure would log again.
    await createApiClient()['client-logs'].$post({ json: { events } })
  } catch {
    // Offline or API down.
  }
}

function enqueue(event: ClientLogEvent) {
  const key = `${event.kind}:${event.message}`
  const now = Date.now()
  const last = recent.get(key)
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return
  recent.set(key, now)
  if (recent.size > 200) recent.clear()

  queue.push(event)
  if (queue.length >= CLIENT_LOG_MAX_EVENTS) {
    void flush()
  } else {
    timer ??= setTimeout(flush, FLUSH_DELAY_MS)
  }
}

/** Sends one event to Seq through the authenticated API endpoint. Safe to call from anywhere. */
export function logClient(
  level: ClientLogEvent['level'],
  message: string,
  extra: { kind?: Kind; stack?: string } = {},
) {
  if (typeof window === 'undefined') return
  enqueue({
    level,
    message: truncateBytes(message || '(no message)', CLIENT_LOG_MAX_MESSAGE_BYTES),
    kind: extra.kind ?? 'manual',
    url: window.location.href.slice(0, CLIENT_LOG_MAX_URL_LENGTH),
    stack: extra.stack?.slice(0, CLIENT_LOG_MAX_STACK_LENGTH),
  })
}

/** Reports an error caught by a React error boundary. */
export function logBoundaryError(error: Error & { digest?: string }) {
  logClient('error', error.message || error.name, {
    kind: 'react-error-boundary',
    stack: error.stack,
  })
}

/** Registers window error and unhandled rejection listeners once. Returns a cleanup function. */
export function installClientLogger(): () => void {
  if (installed || typeof window === 'undefined') return () => {}
  installed = true

  const onError = (event: ErrorEvent) => {
    logClient('error', event.message || 'Script error', {
      kind: 'window-error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
    })
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason
    logClient('error', reason instanceof Error ? reason.message : String(reason), {
      kind: 'unhandled-rejection',
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  }
  const onHide = () => {
    if (document.visibilityState === 'hidden' && queue.length > 0) void flush()
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  document.addEventListener('visibilitychange', onHide)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    document.removeEventListener('visibilitychange', onHide)
    installed = false
  }
}
