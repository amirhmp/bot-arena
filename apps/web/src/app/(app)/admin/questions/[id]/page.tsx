import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { QuestionEditor } from '../question-editor'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('QuestionEditor')
  return { title: t('metaTitleEdit') }
}

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QuestionEditor id={id} />
}
