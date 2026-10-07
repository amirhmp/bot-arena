import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSessionUser } from '@/lib/session'
import { ChangePasswordForm } from './change-password-form'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage() {
  const user = await getSessionUser()
  return (
    <div className="grid max-w-xl grid-cols-1 gap-6">
      <PageHeader title="Account" />
      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>
              An admin manages these. Ask them if something is wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user.name}</dd>
              <dt className="text-muted-foreground">Username</dt>
              <dd>{user.username}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <Badge variant="secondary">{user.role}</Badge>
              </dd>
            </dl>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Your other devices are signed out when you change it.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
