import type { SessionUser } from '@bot-arena/shared'
import { describe, expect, it } from 'vitest'
import { ensureInitialAdmin } from './bootstrap'
import { ADMIN, makeTestApp } from './test-utils'

async function makePlayer(ctx: Awaited<ReturnType<typeof makeTestApp>>) {
  const admin = await ctx.adminCookie()
  const res = await ctx.request('/users', admin, {
    method: 'POST',
    json: { username: 'pat', name: 'Pat', password: 'pat-password-1', role: 'player' },
  })
  expect(res.status).toBe(201)
  return admin
}

describe('authentication', () => {
  it('signs in with username and password and returns the user from /me', async () => {
    const ctx = await makeTestApp()
    const cookie = await ctx.adminCookie()
    const res = await ctx.request('/me', cookie)
    expect(res.status).toBe(200)
    const { user } = (await res.json()) as { user: SessionUser }
    expect(user).toMatchObject({ username: 'admin', role: 'admin' })
  })

  it('rejects a wrong password and anonymous access', async () => {
    const ctx = await makeTestApp()
    await expect(ctx.signIn(ADMIN.username, 'wrong-password')).rejects.toThrow()
    expect((await ctx.request('/me', null)).status).toBe(401)
  })

  it('signs out: the old cookie stops working', async () => {
    const ctx = await makeTestApp()
    const cookie = await ctx.adminCookie()
    const out = await ctx.request('/auth/sign-out', cookie, { method: 'POST', json: {} })
    expect(out.status).toBe(200)
    expect((await ctx.request('/me', cookie)).status).toBe(401)
  })

  it('has no self-registration', async () => {
    const ctx = await makeTestApp()
    const res = await ctx.request('/auth/sign-up/email', null, {
      method: 'POST',
      json: { email: 'new@example.com', password: 'some-password-1', name: 'New' },
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    await expect(ctx.signIn('new', 'some-password-1')).rejects.toThrow()
  })

  it('lets a user change their own password', async () => {
    const ctx = await makeTestApp()
    await makePlayer(ctx)
    const cookie = await ctx.signIn('pat', 'pat-password-1')
    const res = await ctx.request('/auth/change-password', cookie, {
      method: 'POST',
      json: {
        currentPassword: 'pat-password-1',
        newPassword: 'pat-new-password-2',
        revokeOtherSessions: true,
      },
    })
    expect(res.status).toBe(200)
    await expect(ctx.signIn('pat', 'pat-password-1')).rejects.toThrow()
    await expect(ctx.signIn('pat', 'pat-new-password-2')).resolves.toBeTruthy()
  })

  it('logs sign-ins with the user id', async () => {
    const ctx = await makeTestApp()
    await ctx.adminCookie()
    expect(ctx.lines.some((line) => line.msg === 'user signed in' && line.userId)).toBe(true)
  })
})

describe('initial admin', () => {
  it('is created once and never replaces an existing admin', async () => {
    const ctx = await makeTestApp()
    const created = await ensureInitialAdmin(
      ctx.auth,
      { username: 'other', password: 'other-password-1' },
      // The helper logger is private to the app; any logger-shaped object works here.
      { info: () => {} } as never,
    )
    expect(created).toBe(false)
  })
})
