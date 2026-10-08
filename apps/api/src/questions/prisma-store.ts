import type { PrismaClient } from '@bot-arena/db'
import type { QuestionStore, QuestionWithTests, TestCaseRecord } from './store'

const withTests = {
  tests: { orderBy: [{ position: 'asc' as const }, { createdAt: 'asc' as const }] },
}

function toTest(row: TestCaseRecord): TestCaseRecord {
  return {
    id: row.id,
    questionId: row.questionId,
    position: row.position,
    visible: row.visible,
    stdin: row.stdin,
    expectedOutput: row.expectedOutput,
  }
}

function toQuestion(row: QuestionWithTests): QuestionWithTests {
  return { ...row, tests: row.tests.map(toTest) }
}

/** Postgres-backed question store (Prisma). The in-memory twin in `store.ts` is used by tests. */
export function createPrismaQuestionStore(prisma: PrismaClient): QuestionStore {
  return {
    async list(query) {
      const where = {
        ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
        ...(query.tag ? { tags: { has: query.tag } } : {}),
        ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      }
      const [rows, total] = await Promise.all([
        prisma.question.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: query.offset,
          take: query.limit,
          include: withTests,
        }),
        prisma.question.count({ where }),
      ])
      return { items: rows.map(toQuestion), total }
    },

    async get(id) {
      const row = await prisma.question.findUnique({ where: { id }, include: withTests })
      return row ? toQuestion(row) : null
    },

    async create(data, createdById) {
      const row = await prisma.question.create({
        data: { ...data, createdById },
        include: withTests,
      })
      return toQuestion(row)
    },

    async update(id, patch) {
      try {
        const row = await prisma.question.update({ where: { id }, data: patch, include: withTests })
        return toQuestion(row)
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },

    async remove(id) {
      // Tests go with the question (ON DELETE CASCADE).
      const { count } = await prisma.question.deleteMany({ where: { id } })
      return count > 0
    },

    async addTest(questionId, data) {
      return prisma.$transaction(async (tx) => {
        const question = await tx.question.findUnique({
          where: { id: questionId },
          select: { id: true },
        })
        if (!question) return null
        const last = await tx.testCase.aggregate({
          where: { questionId },
          _max: { position: true },
        })
        const row = await tx.testCase.create({
          data: { ...data, questionId, position: (last._max.position ?? -1) + 1 },
        })
        await tx.question.update({ where: { id: questionId }, data: {} })
        return toTest(row)
      })
    },

    async updateTest(questionId, testId, patch) {
      return prisma.$transaction(async (tx) => {
        const { count } = await tx.testCase.updateMany({
          where: { id: testId, questionId },
          data: patch,
        })
        if (count === 0) return null
        await tx.question.update({ where: { id: questionId }, data: {} })
        const row = await tx.testCase.findUniqueOrThrow({ where: { id: testId } })
        return toTest(row)
      })
    },

    async removeTest(questionId, testId) {
      return prisma.$transaction(async (tx) => {
        const { count } = await tx.testCase.deleteMany({ where: { id: testId, questionId } })
        if (count === 0) return false
        await tx.question.update({ where: { id: questionId }, data: {} })
        return true
      })
    },

    async reorderTests(questionId, ids) {
      return prisma.$transaction(async (tx) => {
        const question = await tx.question.findUnique({
          where: { id: questionId },
          select: { id: true },
        })
        if (!question) return null
        for (const [position, id] of ids.entries()) {
          await tx.testCase.updateMany({ where: { id, questionId }, data: { position } })
        }
        await tx.question.update({ where: { id: questionId }, data: {} })
        const rows = await tx.testCase.findMany({
          where: { questionId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        })
        return rows.map(toTest)
      })
    },
  }
}

/** Prisma's "record to update not found" error. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025'
  )
}
