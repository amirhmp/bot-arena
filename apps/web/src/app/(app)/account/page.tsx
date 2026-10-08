import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSessionUser } from '@/lib/session'
import { ChangePasswordForm } from './change-password-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account')
  return { title: t('metaTitle') }
}

export default async function AccountPage() {
  const t = await getTranslations('Account')
  const tRoles = await getTranslations('Roles')
  const user = await getSessionUser()
  return (
    <div className="grid max-w-xl grid-cols-1 gap-6">
      <PageHeader title={t('title')} />
      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('detailsTitle')}</CardTitle>
            <CardDescription>{t('detailsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('name')}</dt>
              <dd>{user.name}</dd>
              <dt className="text-muted-foreground">{t('username')}</dt>
              <dd>{user.username}</dd>
              <dt className="text-muted-foreground">{t('role')}</dt>
              <dd>
                <Badge variant="secondary">{tRoles(user.role)}</Badge>
              </dd>
            </dl>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t('changePasswordTitle')}</CardTitle>
          <CardDescription>{t('changePasswordDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
