import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { QuestionEditor } from '../question-editor'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('QuestionEditor')
  return { title: t('metaTitleNew') }
}

export default function NewQuestionPage() {
  return <QuestionEditor />
}
