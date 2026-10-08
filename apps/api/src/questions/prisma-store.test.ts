import { createPrismaClient, type PrismaClient } from '@bot-arena/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPrismaQuestionStore } from './prisma-store'
import type { QuestionStore } from './store'

// Needs a Postgres with the migrations applied. Skipped when TEST_DATABASE_URL is not set, so the
// default `pnpm test` (and CI today) needs no database. The store contract is also covered by the
// route tests through the in-memory store.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('prisma question store', () => {
  // Created in beforeAll: a skipped describe still runs its body, and there is no URL then.
  let prisma: PrismaClient
  let store: QuestionStore
  const created: string[] = []

  beforeAll(async () => {
    prisma = createPrismaClient(url)
    store = createPrismaQuestionStore(prisma)
    await prisma.$connect()
  })
  afterAll(async () => {
    await prisma.question.deleteMany({ where: { id: { in: created } } })
    await prisma.$disconnect()
  })

  const data = {
    title: 'Prisma sum',
    statementMdx: '# Sum',
    statementCompiled: 'compiled',
    tags: ['graphs', 'dp'],
    difficulty: 'hard' as const,
    timeLimitMs: 1500,
    memoryLimitMb: 128,
    maxScore: 20,
    comparison: 'token' as const,
  }

  it('creates, reads, updates, filters and deletes a question', async () => {
    const question = await store.create(data, null as unknown as string)
    created.push(question.id)
    expect(question).toMatchObject({ ...data, tests: [] })

    const found = await store.get(question.id)
    expect(found?.tags).toEqual(['graphs', 'dp'])

    const before = found!.updatedAt.getTime()
    await new Promise((resolve) => setTimeout(resolve, 15))
    const updated = await store.update(question.id, { title: 'Renamed', tags: ['x'] })
    expect(updated).toMatchObject({ title: 'Renamed', tags: ['x'], maxScore: 20 })
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before)
    expect(await store.update('missing', { title: 'x' })).toBeNull()

    const byTitle = await store.list({ q: 'RENAMED', limit: 10, offset: 0 })
    expect(byTitle.items.map((item) => item.id)).toContain(question.id)
    expect(
      (await store.list({ tag: 'x', limit: 100, offset: 0 })).items.map((i) => i.id),
    ).toContain(question.id)
    expect(
      (await store.list({ difficulty: 'easy', q: 'RENAMED', limit: 10, offset: 0 })).total,
    ).toBe(0)

    expect(await store.remove(question.id)).toBe(true)
    expect(await store.remove(question.id)).toBe(false)
    expect(await store.get(question.id)).toBeNull()
  })

  it('keeps tests ordered, scoped to their question, and removes them with the question', async () => {
    const question = await store.create(data, null as unknown as string)
    created.push(question.id)
    const other = await store.create({ ...data, title: 'Other' }, null as unknown as string)
    created.push(other.id)

    const a = (await store.addTest(question.id, {
      visible: true,
      stdin: 'a',
      expectedOutput: '1',
    }))!
    const b = (await store.addTest(question.id, {
      visible: false,
      stdin: 'b',
      expectedOutput: '2',
    }))!
    const c = (await store.addTest(question.id, {
      visible: false,
      stdin: 'c',
      expectedOutput: '3',
    }))!
    expect([a.position, b.position, c.position]).toEqual([0, 1, 2])
    expect(
      await store.addTest('missing', { visible: true, stdin: '', expectedOutput: '' }),
    ).toBeNull()

    expect(
      (await store.reorderTests(question.id, [c.id, a.id, b.id]))?.map((t) => t.stdin),
    ).toEqual(['c', 'a', 'b'])
    expect((await store.get(question.id))?.tests.map((t) => t.stdin)).toEqual(['c', 'a', 'b'])

    expect(await store.updateTest(other.id, a.id, { visible: false })).toBeNull()
    expect(await store.removeTest(other.id, a.id)).toBe(false)
    expect(await store.updateTest(question.id, a.id, { visible: false, stdin: 'A' })).toMatchObject(
      {
        visible: false,
        stdin: 'A',
        expectedOutput: '1',
      },
    )
    expect(await store.removeTest(question.id, b.id)).toBe(true)
    expect((await store.get(question.id))?.tests.map((t) => t.stdin)).toEqual(['c', 'A'])

    await store.remove(question.id)
    expect(await prisma.testCase.count({ where: { questionId: question.id } })).toBe(0)
  })
})
