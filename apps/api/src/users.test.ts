import type { UserSummary } from '@bot-arena/shared'
import { describe, expect, it } from 'vitest'
import { makeTestApp } from './test-utils'

type Ctx = Awaited<ReturnType<typeof makeTestApp>>

const player = { username: 'pat', name: 'Pat', password: 'pat-password-1', role: 'player' }

async function createPlayer(ctx: Ctx, admin: string, body: object = player) {
  const res = await ctx.request('/users', admin, { method: 'POST', json: body })
  return { res, body: (await res.json()) as { user?: UserSummary; error?: string } }
}

describe('user management', () => {
  it('lets an admin create a user who can then sign in', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    const { res, body } = await createPlayer(ctx, admin)
    expect(res.status).toBe(201)
    expect(body.user).toMatchObject({ username: 'pat', role: 'player', active: true })
    expect(JSON.stringify(body)).not.toContain('pat-password-1')

    const cookie = await ctx.signIn('pat', 'pat-password-1')
    const me = (await (await ctx.request('/me', cookie)).json()) as { user: { role: string } }
    expect(me.user.role).toBe('player')
  })

  it('lists users for admins only', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    await createPlayer(ctx, admin)

    const list = await ctx.request('/users', admin)
    const { users, total } = (await list.json()) as { users: UserSummary[]; total: number }
    expect(total).toBe(2)
    expect(users.map((u) => u.username).sort()).toEqual(['admin', 'pat'])

    const playerCookie = await ctx.signIn('pat', 'pat-password-1')
    expect((await ctx.request('/users', playerCookie)).status).toBe(403)
    expect((await ctx.request('/users', null)).status).toBe(401)
  })

  it('blocks a player from every admin action', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    const { body } = await createPlayer(ctx, admin)
    const id = body.user!.id
    const cookie = await ctx.signIn('pat', 'pat-password-1')

    const attempts = [
      ctx.request('/users', cookie, { method: 'POST', json: { ...player, username: 'evil' } }),
      ctx.request(`/users/${id}`, cookie, { method: 'PATCH', json: { role: 'admin' } }),
      ctx.request(`/users/${id}/password`, cookie, {
        method: 'POST',
        json: { password: 'x'.repeat(10) },
      }),
      ctx.request(`/users/${id}/deactivate`, cookie, { method: 'POST' }),
    ]
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(403)
  })

  it('validates input and rejects duplicate usernames', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    expect((await createPlayer(ctx, admin, { ...player, password: 'short' })).res.status).toBe(400)
    expect((await createPlayer(ctx, admin, { ...player, username: 'Bad Name!' })).res.status).toBe(
      400,
    )
    expect((await createPlayer(ctx, admin, { ...player, role: 'owner' })).res.status).toBe(400)

    expect((await createPlayer(ctx, admin)).res.status).toBe(201)
    expect((await createPlayer(ctx, admin)).res.status).toBe(409)
    // Usernames are case-insensitive.
    expect((await createPlayer(ctx, admin, { ...player, username: 'PAT' })).res.status).toBe(409)
  })

  it('edits name and role', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    const id = (await createPlayer(ctx, admin)).body.user!.id

    const res = await ctx.request(`/users/${id}`, admin, {
      method: 'PATCH',
      json: { name: 'Patricia', role: 'admin' },
    })
    expect(res.status).toBe(200)
    const { user } = (await res.json()) as { user: UserSummary }
    expect(user).toMatchObject({ name: 'Patricia', role: 'admin' })
  })

  it('resets a password and ends the user sessions', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    const id = (await createPlayer(ctx, admin)).body.user!.id
    const oldSession = await ctx.signIn('pat', 'pat-password-1')

    const res = await ctx.request(`/users/${id}/password`, admin, {
      method: 'POST',
      json: { password: 'brand-new-password' },
    })
    expect(res.status).toBe(200)
    expect((await ctx.request('/me', oldSession)).status).toBe(401)
    await expect(ctx.signIn('pat', 'pat-password-1')).rejects.toThrow()
    await expect(ctx.signIn('pat', 'brand-new-password')).resolves.toBeTruthy()
  })

  it('deactivates and reactivates a user', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    const id = (await createPlayer(ctx, admin)).body.user!.id
    const session = await ctx.signIn('pat', 'pat-password-1')

    expect((await ctx.request(`/users/${id}/deactivate`, admin, { method: 'POST' })).status).toBe(
      200,
    )
    expect((await ctx.request('/me', session)).status).toBe(401)
    await expect(ctx.signIn('pat', 'pat-password-1')).rejects.toThrow()

    const list = (await (await ctx.request('/users', admin)).json()) as { users: UserSummary[] }
    expect(list.users.find((u) => u.id === id)?.active).toBe(false)

    expect((await ctx.request(`/users/${id}/activate`, admin, { method: 'POST' })).status).toBe(200)
    await expect(ctx.signIn('pat', 'pat-password-1')).resolves.toBeTruthy()
  })

  it('protects the admin from locking themselves out', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    const me = (await (await ctx.request('/me', admin)).json()) as { user: { id: string } }

    const demote = await ctx.request(`/users/${me.user.id}`, admin, {
      method: 'PATCH',
      json: { role: 'player' },
    })
    expect(demote.status).toBe(400)
    const deactivate = await ctx.request(`/users/${me.user.id}/deactivate`, admin, {
      method: 'POST',
    })
    expect(deactivate.status).toBe(400)
  })

  it('refuses to deactivate or demote the last active admin', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    const second = (await createPlayer(ctx, admin, { ...player, username: 'boss', role: 'admin' }))
      .body.user!
    const secondCookie = await ctx.signIn('boss', 'pat-password-1')

    // Two active admins: the second may deactivate the first, which leaves one.
    const first = (await (await ctx.request('/me', admin)).json()) as { user: { id: string } }
    expect(
      (await ctx.request(`/users/${first.user.id}/deactivate`, secondCookie, { method: 'POST' }))
        .status,
    ).toBe(200)
    // Now `boss` is the last active admin and cannot be removed by anyone.
    const reactivated = await ctx.request(`/users/${second.id}/deactivate`, secondCookie, {
      method: 'POST',
    })
    expect(reactivated.status).toBe(400)
  })

  it('logs admin actions with the actor and the target', async () => {
    const ctx = await makeTestApp()
    const admin = await ctx.adminCookie()
    const id = (await createPlayer(ctx, admin)).body.user!.id
    const line = ctx.lines.find((l) => l.msg === 'user created')
    expect(line).toMatchObject({ targetUserId: id, username: 'pat' })
    expect(line?.userId).toBeTruthy()
    expect(line?.requestId).toBeTruthy()
  })
})
