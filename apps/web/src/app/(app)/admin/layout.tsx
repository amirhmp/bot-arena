import { ShieldAlert } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getSessionUser } from '@/lib/session'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('Admin')
  const user = await getSessionUser()
  if (user?.role !== 'admin') {
    return (
      <Alert variant="destructive" className="max-w-md">
        <ShieldAlert aria-hidden />
        <AlertTitle>{t('onlyTitle')}</AlertTitle>
        <AlertDescription>{t('onlyDescription')}</AlertDescription>
      </Alert>
    )
  }
  return children
}
