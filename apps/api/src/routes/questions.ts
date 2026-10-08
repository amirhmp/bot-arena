import { zValidator } from '@hono/zod-validator'
import {
  createQuestionSchema,
  createTestCaseSchema,
  listQuestionsQuerySchema,
  previewMdxSchema,
  QUESTION_LIMITS,
  reorderTestsSchema,
  updateQuestionSchema,
  updateTestCaseSchema,
  type MdxPreviewResult,
  type QuestionDetail,
  type QuestionSummary,
  type StudentQuestionView,
  type TestCase,
} from '@bot-arena/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { rateLimit } from '../middleware/rate-limit'
import {
  compileStatement,
  describeCompileError,
  MdxCompileError,
  previewStatement,
} from '../questions/mdx'
import type { QuestionStore, QuestionWithTests, TestCaseRecord } from '../questions/store'
import type { AppEnv } from '../types'

const idParam = z.object({ id: z.string().min(1) })
const testParam = z.object({ id: z.string().min(1), testId: z.string().min(1) })

function toTestCase(test: TestCaseRecord): TestCase {
  return {
    id: test.id,
    position: test.position,
    visible: test.visible,
    stdin: test.stdin,
    expectedOutput: test.expectedOutput,
  }
}

function toSummary(question: QuestionWithTests): QuestionSummary {
  const sampleCount = question.tests.filter((test) => test.visible).length
  return {
    id: question.id,
    title: question.title,
    tags: question.tags,
    difficulty: question.difficulty,
    maxScore: question.maxScore,
    sampleCount,
    hiddenCount: question.tests.length - sampleCount,
    updatedAt: question.updatedAt.toISOString(),
  }
}

function toDetail(question: QuestionWithTests): QuestionDetail {
  return {
    id: question.id,
    title: question.title,
    statementMdx: question.statementMdx,
    tags: question.tags,
    difficulty: question.difficulty,
    timeLimitMs: question.timeLimitMs,
    memoryLimitMb: question.memoryLimitMb,
    maxScore: question.maxScore,
    comparison: question.comparison,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
    tests: question.tests.map(toTestCase),
  }
}

/**
 * What students will see. Built field by field from the sample tests only, so hidden tests (and
 * the MDX source) cannot leak by accident (decision 29).
 */
function toStudentView(question: QuestionWithTests): StudentQuestionView {
  return {
    id: question.id,
    title: question.title,
    tags: question.tags,
    difficulty: question.difficulty,
    timeLimitMs: question.timeLimitMs,
    memoryLimitMb: question.memoryLimitMb,
    maxScore: question.maxScore,
    statementCompiled: question.statementCompiled,
    samples: question.tests
      .filter((test) => test.visible)
      .map((test) => ({ id: test.id, stdin: test.stdin, expectedOutput: test.expectedOutput })),
  }
}

/**
 * Question bank management (admin only: mounted behind `requireAuth` and `requireRole('admin')`).
 * Hidden tests appear only in the admin detail; the student view carries samples only.
 */
export function questionRoutes(store: QuestionStore) {
  return (
    new Hono<AppEnv>()
      .get('/', zValidator('query', listQuestionsQuerySchema), async (c) => {
        const { items, total } = await store.list(c.req.valid('query'))
        return c.json({ questions: items.map(toSummary), total })
      })
      .post('/', zValidator('json', createQuestionSchema), async (c) => {
        const input = c.req.valid('json')
        let statementCompiled: string
        try {
          statementCompiled = await compileStatement(input.statementMdx)
        } catch (error) {
          if (error instanceof MdxCompileError) {
            return c.json({ error: describeCompileError(error) }, 400)
          }
          throw error
        }
        const question = await store.create({ ...input, statementCompiled }, c.get('user').id)
        c.get('logger').info({ questionId: question.id, title: question.title }, 'question created')
        return c.json({ question: toDetail(question) }, 201)
      })
      // Live preview while authoring: compiles without saving. A bad statement is data, not an error.
      .post(
        '/preview',
        rateLimit({ limit: 120, windowMs: 60_000 }),
        zValidator('json', previewMdxSchema),
        async (c) => {
          const result: MdxPreviewResult = await previewStatement(c.req.valid('json').mdx)
          return c.json(result)
        },
      )
      .get('/:id', zValidator('param', idParam), async (c) => {
        const question = await store.get(c.req.valid('param').id)
        if (!question) return c.json({ error: 'Question not found' }, 404)
        return c.json({ question: toDetail(question) })
      })
      .patch(
        '/:id',
        zValidator('param', idParam),
        zValidator('json', updateQuestionSchema),
        async (c) => {
          const { id } = c.req.valid('param')
          const input = c.req.valid('json')
          let statementCompiled: string | undefined
          if (input.statementMdx !== undefined) {
            try {
              statementCompiled = await compileStatement(input.statementMdx)
            } catch (error) {
              if (error instanceof MdxCompileError) {
                return c.json({ error: describeCompileError(error) }, 400)
              }
              throw error
            }
          }
          const question = await store.update(id, { ...input, statementCompiled })
          if (!question) return c.json({ error: 'Question not found' }, 404)
          c.get('logger').info({ questionId: id, changes: Object.keys(input) }, 'question updated')
          return c.json({ question: toDetail(question) })
        },
      )
      .delete('/:id', zValidator('param', idParam), async (c) => {
        const { id } = c.req.valid('param')
        if (!(await store.remove(id))) return c.json({ error: 'Question not found' }, 404)
        c.get('logger').info({ questionId: id }, 'question deleted')
        return c.json({ ok: true as const })
      })
      // The question exactly as a student will see it: compiled statement and sample tests only.
      .get('/:id/student-view', zValidator('param', idParam), async (c) => {
        const question = await store.get(c.req.valid('param').id)
        if (!question) return c.json({ error: 'Question not found' }, 404)
        return c.json({ question: toStudentView(question) })
      })
      .post(
        '/:id/tests',
        zValidator('param', idParam),
        zValidator('json', createTestCaseSchema),
        async (c) => {
          const { id } = c.req.valid('param')
          const question = await store.get(id)
          if (!question) return c.json({ error: 'Question not found' }, 404)
          if (question.tests.length >= QUESTION_LIMITS.testsPerQuestionMax) {
            return c.json(
              { error: `A question can have at most ${QUESTION_LIMITS.testsPerQuestionMax} tests` },
              400,
            )
          }
          const test = await store.addTest(id, c.req.valid('json'))
          if (!test) return c.json({ error: 'Question not found' }, 404)
          c.get('logger').info(
            { questionId: id, testId: test.id, visible: test.visible },
            'test case created',
          )
          return c.json({ test: toTestCase(test) }, 201)
        },
      )
      // Registered before `/:id/tests/:testId` so "order" is never read as a test id.
      .put(
        '/:id/tests/order',
        zValidator('param', idParam),
        zValidator('json', reorderTestsSchema),
        async (c) => {
          const { id } = c.req.valid('param')
          const { ids } = c.req.valid('json')
          const question = await store.get(id)
          if (!question) return c.json({ error: 'Question not found' }, 404)
          const current = new Set(question.tests.map((test) => test.id))
          if (
            ids.length !== current.size ||
            new Set(ids).size !== ids.length ||
            !ids.every((x) => current.has(x))
          ) {
            return c.json(
              { error: 'The order must list every test of the question exactly once' },
              400,
            )
          }
          const tests = await store.reorderTests(id, ids)
          if (!tests) return c.json({ error: 'Question not found' }, 404)
          c.get('logger').info({ questionId: id }, 'tests reordered')
          return c.json({ tests: tests.map(toTestCase) })
        },
      )
      .patch(
        '/:id/tests/:testId',
        zValidator('param', testParam),
        zValidator('json', updateTestCaseSchema),
        async (c) => {
          const { id, testId } = c.req.valid('param')
          const test = await store.updateTest(id, testId, c.req.valid('json'))
          if (!test) return c.json({ error: 'Test not found' }, 404)
          c.get('logger').info({ questionId: id, testId }, 'test case updated')
          return c.json({ test: toTestCase(test) })
        },
      )
      .delete('/:id/tests/:testId', zValidator('param', testParam), async (c) => {
        const { id, testId } = c.req.valid('param')
        if (!(await store.removeTest(id, testId))) return c.json({ error: 'Test not found' }, 404)
        c.get('logger').info({ questionId: id, testId }, 'test case deleted')
        return c.json({ ok: true as const })
      })
  )
}
