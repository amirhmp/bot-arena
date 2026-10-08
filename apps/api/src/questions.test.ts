import type {
  MdxPreviewResult,
  QuestionDetail,
  QuestionSummary,
  StudentQuestionView,
  TestCase,
} from '@bot-arena/shared'
import { describe, expect, it } from 'vitest'
import { makeTestApp } from './test-utils'

type Ctx = Awaited<ReturnType<typeof makeTestApp>>

const SECRET = 'HIDDEN-EXPECTED-OUTPUT-42'
const statement = '# Sum\n\nPrint a+b.\n\n```text\n1 2\n```\n\n<Sample input="1 2" output="3" />'

async function createQuestion(ctx: Ctx, cookie: string, body: object = {}) {
  const res = await ctx.request('/questions', cookie, {
    method: 'POST',
    json: { title: 'Sum', statementMdx: statement, ...body },
  })
  return { res, body: (await res.json()) as { question?: QuestionDetail; error?: string } }
}

async function setup() {
  const ctx = await makeTestApp()
  const admin = await ctx.adminCookie()
  await ctx.request('/users', admin, {
    method: 'POST',
    json: { username: 'pat', name: 'Pat', password: 'pat-password-1', role: 'player' },
  })
  const player = await ctx.signIn('pat', 'pat-password-1')
  return { ctx, admin, player }
}

describe('question management', () => {
  it('creates a question with defaults and compiles the statement at save time', async () => {
    const { ctx, admin } = await setup()
    const { res, body } = await createQuestion(ctx, admin, { tags: ['Graphs', 'graphs', ' dp '] })
    expect(res.status).toBe(201)
    expect(body.question).toMatchObject({
      title: 'Sum',
      tags: ['graphs', 'dp'],
      difficulty: 'medium',
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      maxScore: 10,
      comparison: 'trimmed',
      tests: [],
    })
    const stored = await ctx.questions.get(body.question!.id)
    expect(stored?.statementCompiled).toContain('MDXContent')
    expect(stored?.createdById).toBeTruthy()
  })

  it('rejects an invalid statement with the position and stores nothing', async () => {
    const { ctx, admin } = await setup()
    const { res, body } = await createQuestion(ctx, admin, {
      statementMdx: 'ok\n\n{process.exit()}',
    })
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/expressions/)
    expect(body.error).toMatch(/line 3/)
    expect((await ctx.questions.list({ limit: 10, offset: 0 })).total).toBe(0)
  })

  it('validates settings', async () => {
    const { ctx, admin } = await setup()
    for (const bad of [
      { title: '   ' },
      { statementMdx: '  ' },
      { difficulty: 'impossible' },
      { timeLimitMs: 5 },
      { memoryLimitMb: 99999 },
      { maxScore: 0 },
      { comparison: 'fuzzy' },
      { tags: ['Bad Tag!'] },
      { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) },
    ]) {
      expect((await createQuestion(ctx, admin, bad)).res.status).toBe(400)
    }
  })

  it('edits only the fields sent and recompiles when the statement changes', async () => {
    const { ctx, admin } = await setup()
    const id = (await createQuestion(ctx, admin, { maxScore: 50 })).body.question!.id
    const before = (await ctx.questions.get(id))!.statementCompiled

    let res = await ctx.request(`/questions/${id}`, admin, {
      method: 'PATCH',
      json: { title: 'Sum v2', difficulty: 'hard' },
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { question: QuestionDetail }).question).toMatchObject({
      title: 'Sum v2',
      difficulty: 'hard',
      maxScore: 50,
      timeLimitMs: 2000,
    })
    expect((await ctx.questions.get(id))!.statementCompiled).toBe(before)

    res = await ctx.request(`/questions/${id}`, admin, {
      method: 'PATCH',
      json: { statementMdx: '# Changed' },
    })
    expect(res.status).toBe(200)
    expect((await ctx.questions.get(id))!.statementCompiled).not.toBe(before)

    res = await ctx.request(`/questions/${id}`, admin, {
      method: 'PATCH',
      json: { statementMdx: 'import x from "y"' },
    })
    expect(res.status).toBe(400)
    expect((await ctx.questions.get(id))!.statementMdx).toBe('# Changed')

    expect(
      (await ctx.request(`/questions/${id}`, admin, { method: 'PATCH', json: {} })).status,
    ).toBe(400)
    expect(
      (await ctx.request('/questions/nope', admin, { method: 'PATCH', json: { title: 'x' } }))
        .status,
    ).toBe(404)
  })

  it('lists, filters and counts tests, then deletes', async () => {
    const { ctx, admin } = await setup()
    const a = (await createQuestion(ctx, admin, { title: 'Alpha graph', tags: ['graphs'] })).body
      .question!
    await createQuestion(ctx, admin, { title: 'Beta', difficulty: 'easy' })
    await ctx.request(`/questions/${a.id}/tests`, admin, {
      method: 'POST',
      json: { visible: true, stdin: '1', expectedOutput: '1' },
    })
    await ctx.request(`/questions/${a.id}/tests`, admin, {
      method: 'POST',
      json: { visible: false, stdin: '2', expectedOutput: '2' },
    })

    const list = async (query = '') =>
      (await (await ctx.request(`/questions${query}`, admin)).json()) as {
        questions: QuestionSummary[]
        total: number
      }
    expect((await list()).total).toBe(2)
    expect((await list('?q=ALPHA')).questions.map((q) => q.title)).toEqual(['Alpha graph'])
    expect((await list('?tag=graphs')).total).toBe(1)
    expect((await list('?difficulty=easy')).questions.map((q) => q.title)).toEqual(['Beta'])
    expect((await list('?q=alpha')).questions[0]).toMatchObject({ sampleCount: 1, hiddenCount: 1 })

    expect((await ctx.request(`/questions/${a.id}`, admin, { method: 'DELETE' })).status).toBe(200)
    expect((await ctx.request(`/questions/${a.id}`, admin)).status).toBe(404)
    expect((await ctx.request(`/questions/${a.id}`, admin, { method: 'DELETE' })).status).toBe(404)
    expect((await list()).total).toBe(1)
  })

  it('previews a statement without saving it', async () => {
    const { ctx, admin } = await setup()
    const post = async (mdx: string) =>
      (await (
        await ctx.request('/questions/preview', admin, { method: 'POST', json: { mdx } })
      ).json()) as MdxPreviewResult
    expect(await post('# Hello')).toMatchObject({ ok: true })
    expect(await post('<Nope />')).toMatchObject({ ok: false, error: { line: 1 } })
    expect((await ctx.questions.list({ limit: 10, offset: 0 })).total).toBe(0)
  })
})

describe('test cases', () => {
  async function withQuestion() {
    const s = await setup()
    const question = (await createQuestion(s.ctx, s.admin)).body.question!
    const add = async (json: object) => {
      const res = await s.ctx.request(`/questions/${question.id}/tests`, s.admin, {
        method: 'POST',
        json,
      })
      return { res, test: ((await res.json()) as { test?: TestCase }).test }
    }
    const detail = async () =>
      (
        (await (await s.ctx.request(`/questions/${question.id}`, s.admin)).json()) as {
          question: QuestionDetail
        }
      ).question
    return { ...s, question, add, detail }
  }

  it('adds sample and hidden tests in order and normalises line endings', async () => {
    const { add, detail } = await withQuestion()
    const first = await add({ visible: true, stdin: '1 2\r\n', expectedOutput: '3\r\n' })
    expect(first.res.status).toBe(201)
    expect(first.test).toMatchObject({ visible: true, stdin: '1 2\n', expectedOutput: '3\n' })
    await add({ visible: false, stdin: '5 5', expectedOutput: '10' })
    const tests = (await detail()).tests
    expect(tests.map((t) => [t.visible, t.stdin])).toEqual([
      [true, '1 2\n'],
      [false, '5 5'],
    ])
    expect(tests[0]!.position).toBeLessThan(tests[1]!.position)
  })

  it('allows empty input and output but rejects oversized or malformed tests', async () => {
    const { add } = await withQuestion()
    expect((await add({ visible: false, stdin: '', expectedOutput: '' })).res.status).toBe(201)
    expect(
      (await add({ visible: false, stdin: 'x'.repeat(262_145), expectedOutput: '' })).res.status,
    ).toBe(400)
    expect((await add({ stdin: '', expectedOutput: '' })).res.status).toBe(400)
    expect((await add({ visible: 'yes', stdin: '', expectedOutput: '' })).res.status).toBe(400)
  })

  it('caps the number of tests per question', async () => {
    const { ctx, question, add } = await withQuestion()
    for (let i = 0; i < 200; i++) {
      await ctx.questions.addTest(question.id, {
        visible: false,
        stdin: String(i),
        expectedOutput: '',
      })
    }
    const res = await add({ visible: false, stdin: 'one too many', expectedOutput: '' })
    expect(res.res.status).toBe(400)
  })

  it('edits, flips visibility, and deletes a test', async () => {
    const { ctx, admin, question, add, detail } = await withQuestion()
    const test = (await add({ visible: false, stdin: 'a', expectedOutput: 'b' })).test!
    const path = `/questions/${question.id}/tests/${test.id}`

    let res = await ctx.request(path, admin, {
      method: 'PATCH',
      json: { visible: true, expectedOutput: 'c' },
    })
    expect(res.status).toBe(200)
    expect((await detail()).tests[0]).toMatchObject({
      visible: true,
      stdin: 'a',
      expectedOutput: 'c',
    })
    expect((await ctx.request(path, admin, { method: 'PATCH', json: {} })).status).toBe(400)
    expect(
      (
        await ctx.request(`/questions/${question.id}/tests/nope`, admin, {
          method: 'PATCH',
          json: { visible: true },
        })
      ).status,
    ).toBe(404)

    res = await ctx.request(path, admin, { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect((await detail()).tests).toEqual([])
    expect((await ctx.request(path, admin, { method: 'DELETE' })).status).toBe(404)
  })

  it('does not touch a test through another question', async () => {
    const { ctx, admin, add } = await withQuestion()
    const test = (await add({ visible: true, stdin: 'a', expectedOutput: 'b' })).test!
    const other = (await createQuestion(ctx, admin, { title: 'Other' })).body.question!
    const path = `/questions/${other.id}/tests/${test.id}`
    expect(
      (await ctx.request(path, admin, { method: 'PATCH', json: { visible: false } })).status,
    ).toBe(404)
    expect((await ctx.request(path, admin, { method: 'DELETE' })).status).toBe(404)
  })

  it('reorders tests and refuses an incomplete order', async () => {
    const { ctx, admin, question, add, detail } = await withQuestion()
    const a = (await add({ visible: true, stdin: 'a', expectedOutput: '' })).test!
    const b = (await add({ visible: false, stdin: 'b', expectedOutput: '' })).test!
    const c = (await add({ visible: false, stdin: 'c', expectedOutput: '' })).test!
    const put = (ids: string[]) =>
      ctx.request(`/questions/${question.id}/tests/order`, admin, { method: 'PUT', json: { ids } })

    expect((await put([c.id, a.id, b.id])).status).toBe(200)
    expect((await detail()).tests.map((t) => t.stdin)).toEqual(['c', 'a', 'b'])

    expect((await put([a.id, b.id])).status).toBe(400)
    expect((await put([a.id, a.id, b.id])).status).toBe(400)
    expect((await put([a.id, b.id, 'foreign'])).status).toBe(400)
    expect((await detail()).tests.map((t) => t.stdin)).toEqual(['c', 'a', 'b'])
  })
})

describe('student view and access control', () => {
  it('never includes hidden tests or the MDX source in the student view', async () => {
    const { ctx, admin } = await setup()
    const q = (await createQuestion(ctx, admin)).body.question!
    const add = (json: object) =>
      ctx.request(`/questions/${q.id}/tests`, admin, { method: 'POST', json })
    await add({ visible: true, stdin: '1 2', expectedOutput: '3' })
    await add({ visible: false, stdin: `secret-input`, expectedOutput: SECRET })

    const res = await ctx.request(`/questions/${q.id}/student-view`, admin)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain('secret-input')
    expect(text).not.toContain('statementMdx')
    const view = (JSON.parse(text) as { question: StudentQuestionView }).question
    expect(view.samples).toHaveLength(1)
    expect(view.samples[0]).toMatchObject({ stdin: '1 2', expectedOutput: '3' })
    expect(view.statementCompiled).toContain('MDXContent')
    expect(Object.keys(view).sort()).toEqual(
      [
        'difficulty',
        'id',
        'maxScore',
        'memoryLimitMb',
        'samples',
        'statementCompiled',
        'tags',
        'timeLimitMs',
        'title',
      ].sort(),
    )
    expect((await ctx.request('/questions/nope/student-view', admin)).status).toBe(404)
  })

  it('blocks players and anonymous users from every question route', async () => {
    const { ctx, admin, player } = await setup()
    const q = (await createQuestion(ctx, admin)).body.question!
    const t = (await ctx.questions.addTest(q.id, {
      visible: false,
      stdin: '',
      expectedOutput: SECRET,
    }))!

    const calls: [string, string, object?][] = [
      ['GET', '/questions'],
      ['POST', '/questions', { title: 'x', statementMdx: 'x' }],
      ['POST', '/questions/preview', { mdx: 'x' }],
      ['GET', `/questions/${q.id}`],
      ['PATCH', `/questions/${q.id}`, { title: 'x' }],
      ['DELETE', `/questions/${q.id}`],
      ['GET', `/questions/${q.id}/student-view`],
      ['POST', `/questions/${q.id}/tests`, { visible: true, stdin: '', expectedOutput: '' }],
      ['PUT', `/questions/${q.id}/tests/order`, { ids: [t.id] }],
      ['PATCH', `/questions/${q.id}/tests/${t.id}`, { visible: true }],
      ['DELETE', `/questions/${q.id}/tests/${t.id}`],
    ]
    for (const [method, path, json] of calls) {
      const asPlayer = await ctx.request(path, player, { method, json })
      expect(asPlayer.status, `${method} ${path} as player`).toBe(403)
      expect(await asPlayer.text()).not.toContain(SECRET)
      const anonymous = await ctx.request(path, null, { method, json })
      expect(anonymous.status, `${method} ${path} anonymous`).toBe(401)
    }
    // Nothing changed.
    expect((await ctx.questions.get(q.id))?.tests).toHaveLength(1)
  })

  it('logs question changes with the user and question ids', async () => {
    const { ctx, admin } = await setup()
    const q = (await createQuestion(ctx, admin)).body.question!
    await ctx.request(`/questions/${q.id}`, admin, { method: 'DELETE' })
    const created = ctx.lines.find((line) => line.msg === 'question created')
    const deleted = ctx.lines.find((line) => line.msg === 'question deleted')
    expect(created).toMatchObject({ questionId: q.id })
    expect(created?.userId).toBeTruthy()
    expect(deleted).toMatchObject({ questionId: q.id })
  })
})

describe('preview rate limit', () => {
  it('limits live-preview requests per user', async () => {
    const { ctx, admin } = await setup()
    let last = 200
    for (let i = 0; i < 121; i++) {
      last = (await ctx.request('/questions/preview', admin, { method: 'POST', json: { mdx: '' } }))
        .status
    }
    expect(last).toBe(429)
  })
})
