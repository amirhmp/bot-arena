import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Home' }

const ADMIN_LINKS = [
  {
    href: '/admin/questions',
    title: 'Questions',
    text: 'Write questions with sample and hidden tests.',
  },
  {
    href: '/admin/users',
    title: 'Users',
    text: 'Create accounts, reset passwords and assign roles.',
  },
  {
    href: '/admin/status',
    title: 'Status',
    text: 'Check that the API, database and log server are up.',
  },
]

export default async function HomePage() {
  const user = await getSessionUser()
  const isAdmin = user?.role === 'admin'
  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        title={`Welcome, ${user?.name ?? ''}`}
        description={
          isAdmin
            ? 'Quizzes and contests arrive in later releases. For now you can manage who can sign in.'
            : undefined
        }
      />
      {isAdmin ? (
        <ul className="divide-y rounded-lg border bg-card">
          {ADMIN_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between gap-4 px-5 py-4 outline-none transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="grid gap-0.5">
                  <span className="font-medium">{link.title}</span>
                  <span className="text-sm text-muted-foreground">{link.text}</span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed p-8">
          <h2 className="text-lg">Nothing assigned yet</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            When an admin assigns you a quiz or contest, it will show up here.
          </p>
        </div>
      )}
    </div>
  )
}
