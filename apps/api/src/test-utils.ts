import { createLogger } from '@bot-arena/logger'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { Writable } from 'node:stream'
import { createApp, type AppOptions } from './app'
import { createAuth } from './auth'
import { ensureInitialAdmin } from './bootstrap'

export const ADMIN = { username: 'admin', password: 'admin-password-1' }
const ORIGIN = 'http://localhost:3000'

export type LogLine = Record<string, unknown> & { msg?: string }

/** A full app on the in-memory Better Auth adapter, with captured log lines and an admin account. */
export async function makeTestApp(
  overrides: Partial<Pick<AppOptions, 'status' | 'clientLogs'>> = {},
) {
  const lines: LogLine[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).split('\n')) {
        if (line.trim()) lines.push(JSON.parse(line) as LogLine)
      }
      callback()
    },
  })
  const logger = createLogger({ service: 'api', level: 'debug', stream })
  const auth = createAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    secret: 'test-secret-test-secret-test-secret-123',
    baseURL: 'http://localhost:4000',
    trustedOrigins: [ORIGIN],
    logger,
  })
  await ensureInitialAdmin(auth, ADMIN, logger)
  const app = createApp({
    logger,
    auth,
    status: overrides.status ?? { pingDatabase: async () => {} },
    clientLogs: overrides.clientLogs,
  })

  /** Signs in through the real endpoint and returns the cookie header for later requests. */
  async function signIn(username: string, password: string): Promise<string> {
    const res = await app.request('/auth/sign-in/username', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ username, password }),
    })
    if (res.status !== 200) throw new Error(`sign-in failed with ${res.status}`)
    const cookies = res.headers.getSetCookie().map((cookie) => cookie.split(';')[0])
    return cookies.join('; ')
  }

  /** Request helper that sends the cookie and the trusted origin (Better Auth checks it on POST). */
  function request(
    path: string,
    cookie: string | null,
    init: RequestInit & { json?: unknown } = {},
  ) {
    const { json, ...rest } = init
    const headers = new Headers(rest.headers)
    if (cookie) headers.set('cookie', cookie)
    headers.set('origin', ORIGIN)
    if (json !== undefined) headers.set('content-type', 'application/json')
    return app.request(path, {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  }

  return {
    app,
    auth,
    lines,
    signIn,
    request,
    adminCookie: () => signIn(ADMIN.username, ADMIN.password),
  }
}
