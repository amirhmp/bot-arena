import type { Metadata } from 'next'
import { StudentPreview } from './student-preview'

export const metadata: Metadata = { title: 'Student preview' }

export default async function QuestionPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StudentPreview id={id} />
}
