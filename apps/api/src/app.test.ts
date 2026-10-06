import type { SystemStatus } from '@bot-arena/shared'
import { describe, expect, it } from 'vitest'
import { makeTestApp } from './test-utils'

describe('api', () => {
  it('returns a request id header', async () => {
    const { app } = await makeTestApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('reuses a well-formed incoming request id', async () => {
    const { app } = await makeTestApp()
    const res = await app.request('/health', { headers: { 'x-request-id': 'abc12345-test' } })
    expect(res.headers.get('x-request-id')).toBe('abc12345-test')
  })

  it('reports degraded when the database is down', async () => {
    const { request, adminCookie } = await makeTestApp({
      status: {
        pingDatabase: async () => {
          throw new Error('db down')
        },
      },
    })
    const res = await request('/status', await adminCookie())
    const body = (await res.json()) as SystemStatus
    expect(body.status).toBe('degraded')
    expect(body.services.database.status).toBe('down')
    expect(body.services.api.status).toBe('ok')
  })

  it('keeps the status route behind the admin role', async () => {
    const { request, signIn, adminCookie } = await makeTestApp()
    expect((await request('/status', null)).status).toBe(401)

    await request('/users', await adminCookie(), {
      method: 'POST',
      json: { username: 'pat', name: 'Pat', password: 'pat-password-1', role: 'player' },
    })
    const player = await signIn('pat', 'pat-password-1')
    expect((await request('/status', player)).status).toBe(403)
  })
})
