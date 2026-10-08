import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { StudentPreview } from './student-preview'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('StudentPreview')
  return { title: t('metaTitle') }
}

export default async function QuestionPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StudentPreview id={id} />
}
