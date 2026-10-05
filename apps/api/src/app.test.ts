import { createLogger } from '@bot-arena/logger'
import type { SystemStatus } from '@bot-arena/shared'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'

function makeApp(pingDatabase: () => Promise<void>) {
  return createApp({
    logger: createLogger({ service: 'api', level: 'silent' }),
    status: { pingDatabase },
  })
}

describe('api', () => {
  it('returns a request id header', async () => {
    const res = await makeApp(async () => {}).request('/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('reuses a well-formed incoming request id', async () => {
    const res = await makeApp(async () => {}).request('/health', {
      headers: { 'x-request-id': 'abc12345-test' },
    })
    expect(res.headers.get('x-request-id')).toBe('abc12345-test')
  })

  it('reports degraded when the database is down', async () => {
    const res = await makeApp(async () => {
      throw new Error('db down')
    }).request('/status')
    const body = (await res.json()) as SystemStatus
    expect(body.status).toBe('degraded')
    expect(body.services.database.status).toBe('down')
    expect(body.services.api.status).toBe('ok')
  })
})
