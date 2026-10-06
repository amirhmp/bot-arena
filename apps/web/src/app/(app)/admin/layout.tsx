import type { ReactNode } from 'react'
import { getSessionUser } from '@/lib/session'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()
  if (user?.role !== 'admin') {
    return (
      <div role="alert" className="max-w-md">
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Your account does not have access to this page.
        </p>
      </div>
    )
  }
  return children
}
