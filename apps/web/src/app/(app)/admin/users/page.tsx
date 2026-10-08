import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { getSessionUser } from '@/lib/session'
import { UsersView } from './users-view'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Users')
  return { title: t('metaTitle') }
}

export default async function UsersPage() {
  const t = await getTranslations('Users')
  const user = await getSessionUser()
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <UsersView currentUserId={user?.id ?? ''} />
    </div>
  )
}
