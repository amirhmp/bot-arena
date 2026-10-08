import type {
  ComparisonRule,
  CreateQuestionInput,
  CreateTestCaseInput,
  Difficulty,
  ListQuestionsQuery,
  UpdateQuestionInput,
  UpdateTestCaseInput,
} from '@bot-arena/shared'
import { randomUUID } from 'node:crypto'

export type TestCaseRecord = {
  id: string
  questionId: string
  position: number
  visible: boolean
  stdin: string
  expectedOutput: string
}

export type QuestionRecord = {
  id: string
  title: string
  statementMdx: string
  statementCompiled: string
  tags: string[]
  difficulty: Difficulty
  timeLimitMs: number
  memoryLimitMb: number
  maxScore: number
  comparison: ComparisonRule
  createdById: string | null
  createdAt: Date
  updatedAt: Date
}

export type QuestionWithTests = QuestionRecord & { tests: TestCaseRecord[] }

/** The compiled statement is produced by the route, so the store only persists it. */
export type NewQuestion = CreateQuestionInput & { statementCompiled: string }
export type QuestionPatch = UpdateQuestionInput & { statementCompiled?: string }

/**
 * Where questions and their tests live. Injected into `createApp()` like the database ping:
 * Prisma in production (`prisma-store.ts`), an in-memory copy in tests (no database needed).
 * Tests of a question are always returned ordered by `position`.
 */
export interface QuestionStore {
  list(query: ListQuestionsQuery): Promise<{ items: QuestionWithTests[]; total: number }>
  get(id: string): Promise<QuestionWithTests | null>
  create(data: NewQuestion, createdById: string): Promise<QuestionWithTests>
  update(id: string, patch: QuestionPatch): Promise<QuestionWithTests | null>
  remove(id: string): Promise<boolean>
  addTest(questionId: string, data: CreateTestCaseInput): Promise<TestCaseRecord | null>
  updateTest(
    questionId: string,
    testId: string,
    patch: UpdateTestCaseInput,
  ): Promise<TestCaseRecord | null>
  removeTest(questionId: string, testId: string): Promise<boolean>
  /** `ids` must be exactly the question's test ids (the route checks). Returns the new order. */
  reorderTests(questionId: string, ids: string[]): Promise<TestCaseRecord[] | null>
}

/** Shared by both stores so they filter the same way. */
export function matchesQuery(question: QuestionRecord, query: ListQuestionsQuery): boolean {
  if (query.q && !question.title.toLowerCase().includes(query.q.toLowerCase())) return false
  if (query.tag && !question.tags.includes(query.tag)) return false
  if (query.difficulty && question.difficulty !== query.difficulty) return false
  return true
}

/** In-memory store for tests. Behaves like the Prisma store, minus persistence. */
export function createMemoryQuestionStore(): QuestionStore {
  const questions = new Map<string, QuestionRecord>()
  const tests = new Map<string, TestCaseRecord[]>()

  const testsOf = (id: string) => [...(tests.get(id) ?? [])].sort((a, b) => a.position - b.position)
  const withTests = (question: QuestionRecord): QuestionWithTests => ({
    ...question,
    tags: [...question.tags],
    tests: testsOf(question.id).map((test) => ({ ...test })),
  })
  const touch = (question: QuestionRecord) => {
    question.updatedAt = new Date()
  }

  return {
    async list(query) {
      const matching = [...questions.values()]
        .filter((question) => matchesQuery(question, query))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      return {
        items: matching.slice(query.offset, query.offset + query.limit).map(withTests),
        total: matching.length,
      }
    },
    async get(id) {
      const question = questions.get(id)
      return question ? withTests(question) : null
    },
    async create(data, createdById) {
      const now = new Date()
      const question: QuestionRecord = {
        id: randomUUID(),
        title: data.title,
        statementMdx: data.statementMdx,
        statementCompiled: data.statementCompiled,
        tags: data.tags,
        difficulty: data.difficulty,
        timeLimitMs: data.timeLimitMs,
        memoryLimitMb: data.memoryLimitMb,
        maxScore: data.maxScore,
        comparison: data.comparison,
        createdById,
        createdAt: now,
        updatedAt: now,
      }
      questions.set(question.id, question)
      tests.set(question.id, [])
      return withTests(question)
    },
    async update(id, patch) {
      const question = questions.get(id)
      if (!question) return null
      // Like Prisma, ignore fields that are not set.
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) Object.assign(question, { [key]: value })
      }
      touch(question)
      return withTests(question)
    },
    async remove(id) {
      tests.delete(id)
      return questions.delete(id)
    },
    async addTest(questionId, data) {
      const question = questions.get(questionId)
      if (!question) return null
      const list = tests.get(questionId) ?? []
      const test: TestCaseRecord = {
        id: randomUUID(),
        questionId,
        position: list.reduce((max, item) => Math.max(max, item.position + 1), 0),
        ...data,
      }
      list.push(test)
      tests.set(questionId, list)
      touch(question)
      return { ...test }
    },
    async updateTest(questionId, testId, patch) {
      const question = questions.get(questionId)
      const test = tests.get(questionId)?.find((item) => item.id === testId)
      if (!question || !test) return null
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) Object.assign(test, { [key]: value })
      }
      touch(question)
      return { ...test }
    },
    async removeTest(questionId, testId) {
      const question = questions.get(questionId)
      const list = tests.get(questionId)
      if (!question || !list) return false
      const index = list.findIndex((item) => item.id === testId)
      if (index < 0) return false
      list.splice(index, 1)
      touch(question)
      return true
    },
    async reorderTests(questionId, ids) {
      const question = questions.get(questionId)
      const list = tests.get(questionId)
      if (!question || !list) return null
      ids.forEach((id, position) => {
        const test = list.find((item) => item.id === id)
        if (test) test.position = position
      })
      touch(question)
      return testsOf(questionId).map((test) => ({ ...test }))
    },
  }
}
