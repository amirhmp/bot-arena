import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getSessionUser } from '@/lib/session'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()
  if (user?.role !== 'admin') {
    return (
      <Alert variant="destructive" className="max-w-md">
        <ShieldAlert aria-hidden />
        <AlertTitle>Admins only</AlertTitle>
        <AlertDescription>
          Your account does not have access to this page. Ask an admin if you need it.
        </AlertDescription>
      </Alert>
    )
  }
  return children
}
