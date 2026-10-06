import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'
import { getSessionUser } from '@/lib/session'

// Every page in this group needs a session; the user is checked on each request.
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return <AppShell user={user}>{children}</AppShell>
}
