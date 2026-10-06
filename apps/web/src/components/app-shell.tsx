import type { SessionUser } from '@bot-arena/shared'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ClientLogger } from './client-logger'
import { SignOutButton } from './sign-out-button'

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/', label: 'Home' },
  { href: '/admin/users', label: 'Users', adminOnly: true },
  { href: '/admin/status', label: 'Status', adminOnly: true },
  { href: '/changelog', label: 'Changelog' },
]

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <ClientLogger />
      <header className="border-b border-neutral-300 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-3">
          <nav aria-label="Main" className="flex items-center gap-4 text-sm">
            <Link href="/" className="font-semibold">
              Bot Arena
            </Link>
            {NAV.filter((item) => !item.adminOnly || user.role === 'admin').map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-neutral-600 hover:underline dark:text-neutral-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/account" className="hover:underline">
              {user.name}
            </Link>
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
              {user.role}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  )
}
