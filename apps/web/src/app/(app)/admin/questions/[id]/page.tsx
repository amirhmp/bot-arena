import type { Metadata } from 'next'
import { QuestionEditor } from '../question-editor'

export const metadata: Metadata = { title: 'Edit question' }

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QuestionEditor id={id} />
}
