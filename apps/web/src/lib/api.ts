import type { AppType } from '@bot-arena/api'
import { hc } from 'hono/client'

/**
 * Typed Hono RPC client. In the browser the base URL is NEXT_PUBLIC_API_URL
 * ("/api" in production, where Caddy serves both on one domain). On the server it is API_URL.
 */
export function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000'
  }
  const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  return url.startsWith('/') ? `${window.location.origin}${url}` : url
}

export function createApiClient() {
  return hc<AppType>(apiBaseUrl(), { init: { credentials: 'include' } })
}

/** Reads the `{ error }` message of a failed API response. */
export async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    if (typeof body.error === 'string') return body.error
  } catch {
    // Not JSON.
  }
  return `Request failed (${res.status})`
}
