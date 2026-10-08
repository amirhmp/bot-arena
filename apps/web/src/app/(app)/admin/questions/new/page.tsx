import type { Metadata } from 'next'
import { QuestionEditor } from '../question-editor'

export const metadata: Metadata = { title: 'New question' }

export default function NewQuestionPage() {
  return <QuestionEditor />
}
