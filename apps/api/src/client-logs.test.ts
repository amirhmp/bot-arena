import { describe, expect, it } from 'vitest'
import { makeTestApp } from './test-utils'

const event = {
  level: 'error',
  message: 'boom',
  kind: 'window-error',
  url: 'http://localhost:3000/x',
}

describe('client logs', () => {
  it('requires a session', async () => {
    const { request } = await makeTestApp()
    const res = await request('/client-logs', null, { method: 'POST', json: { events: [event] } })
    expect(res.status).toBe(401)
  })

  it('writes events with identity added by the server', async () => {
    const ctx = await makeTestApp()
    const cookie = await ctx.adminCookie()
    const res = await ctx.request('/client-logs', cookie, {
      method: 'POST',
      json: { events: [event, { level: 'warn', message: 'careful' }] },
    })
    expect(res.status).toBe(202)

    const me = (await (await ctx.request('/me', cookie)).json()) as { user: { id: string } }
    const line = ctx.lines.find((l) => l.msg === 'boom')
    expect(line).toMatchObject({
      source: 'client',
      userId: me.user.id,
      kind: 'window-error',
      service: 'api',
      level: 50,
    })
    expect(line?.requestId).toBeTruthy()
    expect(ctx.lines.find((l) => l.msg === 'careful')?.level).toBe(40)
  })

  it('cannot spoof identity fields', async () => {
    const ctx = await makeTestApp()
    const cookie = await ctx.adminCookie()
    const res = await ctx.request('/client-logs', cookie, {
      method: 'POST',
      json: { events: [{ ...event, userId: 'someone-else', source: 'server' }] },
    })
    expect(res.status).toBe(400)
    expect(ctx.lines.some((l) => l.userId === 'someone-else')).toBe(false)
  })

  it('rejects invalid batches', async () => {
    const ctx = await makeTestApp()
    const cookie = await ctx.adminCookie()
    const post = (json: unknown) => ctx.request('/client-logs', cookie, { method: 'POST', json })

    expect((await post({ events: [] })).status).toBe(400)
    expect((await post({ events: Array.from({ length: 21 }, () => event) })).status).toBe(400)
    expect((await post({ events: [{ ...event, level: 'fatal' }] })).status).toBe(400)
    expect((await post({ events: [{ ...event, message: 'x'.repeat(2049) }] })).status).toBe(400)
    expect((await post({ events: [{ ...event, message: '' }] })).status).toBe(400)
    expect((await post({ events: Array.from({ length: 20 }, () => event) })).status).toBe(202)
    expect((await post({ events: [{ ...event, message: 'x'.repeat(2048) }] })).status).toBe(202)
  })

  it('limits the request body size', async () => {
    const ctx = await makeTestApp()
    const cookie = await ctx.adminCookie()
    const res = await ctx.request('/client-logs', cookie, {
      method: 'POST',
      json: { events: [{ ...event, stack: 'x'.repeat(100_000) }] },
    })
    expect(res.status).toBe(413)
  })

  it('rate-limits per user', async () => {
    let time = 0
    const ctx = await makeTestApp({
      clientLogs: { rateLimit: { limit: 2, windowMs: 1000, now: () => time } },
    })
    const cookie = await ctx.adminCookie()
    const post = () =>
      ctx.request('/client-logs', cookie, { method: 'POST', json: { events: [event] } })

    expect((await post()).status).toBe(202)
    expect((await post()).status).toBe(202)
    const limited = await post()
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()

    time = 1500
    expect((await post()).status).toBe(202)
  })
})
