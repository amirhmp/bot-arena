import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { QuestionsView } from './questions-view'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Questions')
  return { title: t('metaTitle') }
}

export default async function QuestionsPage() {
  const t = await getTranslations('Questions')
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button asChild>
            <Link href="/admin/questions/new">
              <Plus aria-hidden />
              {t('newQuestion')}
            </Link>
          </Button>
        }
      />
      <QuestionsView />
    </div>
  )
}
