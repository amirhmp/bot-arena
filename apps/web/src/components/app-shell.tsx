import type { SessionUser } from '@bot-arena/shared'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BrandMark } from './brand-mark'
import { ClientLogger } from './client-logger'
import { MainNav, type NavItem } from './main-nav'
import { UserMenu } from './user-menu'

const NAV: (NavItem & { adminOnly?: boolean })[] = [
  { href: '/', label: 'Home' },
  { href: '/admin/questions', label: 'Questions', adminOnly: true },
  { href: '/admin/users', label: 'Users', adminOnly: true },
  { href: '/admin/status', label: 'Status', adminOnly: true },
  { href: '/changelog', label: 'Changelog' },
]

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const items = NAV.filter((item) => !item.adminOnly || user.role === 'admin').map(
    ({ href, label }) => ({ href, label }),
  )
  return (
    <div className="min-h-screen">
      <ClientLogger />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 px-4">
          <Link href="/" className="flex h-12 items-center gap-2 text-lg font-bold">
            <BrandMark className="text-primary" />
            Bot Arena
          </Link>
          <div className="order-2 sm:order-3">
            <UserMenu user={user} />
          </div>
          <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1">
            <MainNav items={items} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
