import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { logger } from '@/lib/logger'
import { StatusView } from './status-view'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Status')
  return { title: t('metaTitle') }
}

// Never prerender: the log line below should appear for every visit.
export const dynamic = 'force-dynamic'

export default async function StatusPage() {
  const t = await getTranslations('Status')
  logger.info({ page: '/admin/status' }, 'status page rendered')
  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <StatusView />
    </div>
  )
}
