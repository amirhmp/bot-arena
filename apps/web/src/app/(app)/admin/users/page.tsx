import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { getSessionUser } from '@/lib/session'
import { UsersView } from './users-view'

export const metadata: Metadata = { title: 'Users' }

export default async function UsersPage() {
  const user = await getSessionUser()
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Users"
        description="Create accounts, set initial passwords and assign roles. Players cannot sign themselves up."
      />
      <UsersView currentUserId={user?.id ?? ''} />
    </div>
  )
}
