import { z } from 'zod'

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export const difficultySchema = z.enum(DIFFICULTIES)
export type Difficulty = z.infer<typeof difficultySchema>

/**
 * How a program's output is compared with a test's expected output (decision 29):
 * - `trimmed`: whitespace-trimmed exact match (default)
 * - `strict`: byte-for-byte
 * - `token`: the same whitespace-separated tokens, in the same order
 */
export const COMPARISON_RULES = ['trimmed', 'strict', 'token'] as const
export const comparisonRuleSchema = z.enum(COMPARISON_RULES)
export type ComparisonRule = z.infer<typeof comparisonRuleSchema>

export const QUESTION_LIMITS = {
  titleMax: 200,
  /** MDX source size, in characters. */
  statementMax: 100_000,
  tagsMax: 10,
  tagMax: 32,
  timeLimitMs: { min: 100, max: 30_000, default: 2_000 },
  memoryLimitMb: { min: 16, max: 1_024, default: 256 },
  maxScore: { min: 1, max: 1_000, default: 10 },
  /** Per field, in characters. */
  testDataMax: 262_144,
  testsPerQuestionMax: 200,
} as const

/** Tags are lowercase words joined by hyphens, dots or underscores (for example `graphs`, `two-pointers`). */
export const TAG_PATTERN = /^[a-z0-9][a-z0-9_.+-]*$/
export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Tag is empty')
  .max(QUESTION_LIMITS.tagMax, `Tag must be at most ${QUESTION_LIMITS.tagMax} characters`)
  .regex(TAG_PATTERN, 'Use letters, digits, hyphens, dots and underscores only')

export const tagsSchema = z
  .array(tagSchema)
  .max(QUESTION_LIMITS.tagsMax, `At most ${QUESTION_LIMITS.tagsMax} tags`)
  .transform((tags) => [...new Set(tags)])

export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(QUESTION_LIMITS.titleMax, `Title must be at most ${QUESTION_LIMITS.titleMax} characters`)

export const statementMdxSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Statement is required')
  .refine(
    (value) => value.length <= QUESTION_LIMITS.statementMax,
    `Statement must be at most ${QUESTION_LIMITS.statementMax} characters`,
  )

const timeLimitSchema = z
  .number()
  .int()
  .min(QUESTION_LIMITS.timeLimitMs.min)
  .max(QUESTION_LIMITS.timeLimitMs.max)
const memoryLimitSchema = z
  .number()
  .int()
  .min(QUESTION_LIMITS.memoryLimitMb.min)
  .max(QUESTION_LIMITS.memoryLimitMb.max)
const maxScoreSchema = z
  .number()
  .int()
  .min(QUESTION_LIMITS.maxScore.min)
  .max(QUESTION_LIMITS.maxScore.max)

const questionFields = {
  title: titleSchema,
  statementMdx: statementMdxSchema,
  tags: tagsSchema,
  difficulty: difficultySchema,
  timeLimitMs: timeLimitSchema,
  memoryLimitMb: memoryLimitSchema,
  maxScore: maxScoreSchema,
  comparison: comparisonRuleSchema,
}

/** Creating a question: only the title and the statement are required. */
export const createQuestionSchema = z.object({
  ...questionFields,
  tags: questionFields.tags.default([]),
  difficulty: questionFields.difficulty.default('medium'),
  timeLimitMs: questionFields.timeLimitMs.default(QUESTION_LIMITS.timeLimitMs.default),
  memoryLimitMb: questionFields.memoryLimitMb.default(QUESTION_LIMITS.memoryLimitMb.default),
  maxScore: questionFields.maxScore.default(QUESTION_LIMITS.maxScore.default),
  comparison: questionFields.comparison.default('trimmed'),
})
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>

// Built from the plain fields (no defaults) so an omitted field is never overwritten by a default.
export const updateQuestionSchema = z
  .object(questionFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update')
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>

export const listQuestionsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().toLowerCase().max(QUESTION_LIMITS.tagMax).optional(),
  difficulty: difficultySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>

/** Test data is stored with `\n` line endings: the sandbox runs on Linux, so `\r\n` would only cause surprises. */
const testDataSchema = z
  .string()
  .max(QUESTION_LIMITS.testDataMax, `At most ${QUESTION_LIMITS.testDataMax} characters`)
  .transform((value) => value.replace(/\r\n?/g, '\n'))

const testCaseFields = {
  /** Visible tests are samples students can see; hidden tests never leave the server. */
  visible: z.boolean(),
  stdin: testDataSchema,
  expectedOutput: testDataSchema,
}

export const createTestCaseSchema = z.object(testCaseFields)
export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>

export const updateTestCaseSchema = z
  .object(testCaseFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update')
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseSchema>

/** The new order of a question's tests: every test id exactly once. */
export const reorderTestsSchema = z.object({
  ids: z.array(z.string().min(1)).max(QUESTION_LIMITS.testsPerQuestionMax),
})

/** A test case as an admin sees it (hidden ones included). */
export type TestCase = {
  id: string
  position: number
  visible: boolean
  stdin: string
  expectedOutput: string
}

/** A row in the admin question list. */
export type QuestionSummary = {
  id: string
  title: string
  tags: string[]
  difficulty: Difficulty
  maxScore: number
  sampleCount: number
  hiddenCount: number
  updatedAt: string
}

/** A question as the admin editor sees it: the source, the settings and every test. */
export type QuestionDetail = {
  id: string
  title: string
  statementMdx: string
  tags: string[]
  difficulty: Difficulty
  timeLimitMs: number
  memoryLimitMb: number
  maxScore: number
  comparison: ComparisonRule
  createdAt: string
  updatedAt: string
  tests: TestCase[]
}

/**
 * A question as students will see it. It carries the compiled statement and the sample tests only:
 * hidden tests and their expected outputs are never part of this shape (decision 29).
 */
export type StudentQuestionView = {
  id: string
  title: string
  tags: string[]
  difficulty: Difficulty
  timeLimitMs: number
  memoryLimitMb: number
  maxScore: number
  statementCompiled: string
  samples: { id: string; stdin: string; expectedOutput: string }[]
}

export const previewMdxSchema = z.object({
  // Not length-limited by `statementMdxSchema` messages: an empty draft previews as an empty page.
  mdx: z.string().max(QUESTION_LIMITS.statementMax),
})

export type MdxPreviewResult =
  | { ok: true; compiled: string }
  | { ok: false; error: { message: string; line?: number; column?: number } }
