import type { QuestionDetail } from '@bot-arena/shared'
import { createApiClient, readApiError } from '@/lib/api'

export const QUESTIONS_KEY = ['questions'] as const
export const questionKey = (id: string) => ['question', id] as const
export const studentViewKey = (id: string) => ['question', id, 'student-view'] as const

/** Throws the API's error message for a failed response, so mutations surface it. */
export async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await readApiError(res))
}

export async function fetchQuestion(id: string): Promise<QuestionDetail> {
  const res = await createApiClient().questions[':id'].$get({ param: { id } })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()).question
}
