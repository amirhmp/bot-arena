import 'server-only'
import { sessionUserSchema, type SessionUser } from '@bot-arena/shared'
import { cookies } from 'next/headers'
import { cache } from 'react'

/**
 * The signed-in user for this request, or null. Runs on the server: forwards the browser's
 * cookies to the API's /me route, so the API stays the only place that validates sessions.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) return null
  try {
    const res = await fetch(`${process.env.API_URL ?? 'http://localhost:4000'}/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body = (await res.json()) as { user?: unknown }
    const parsed = sessionUserSchema.safeParse(body.user)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
})
