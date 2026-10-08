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

/**
 * A failed API response. `message` is the server's own text (English, from the API) and is empty
 * when the body had none; screens show it through `useErrorMessage()`, which supplies a
 * translated fallback built from `status`.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Reads the `{ error }` message of a failed API response into an `ApiError` to throw. */
export async function readApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: unknown }
    if (typeof body.error === 'string') return new ApiError(res.status, body.error)
  } catch {
    // Not JSON.
  }
  return new ApiError(res.status)
}
