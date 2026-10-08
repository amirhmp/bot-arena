'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export type NavItem = { href: string; label: string }

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

/** Main navigation. The current page is marked for sighted users and for screen readers. */
export function MainNav({ items }: { items: NavItem[] }) {
  const t = useTranslations('Nav')
  const pathname = usePathname()
  return (
    <nav aria-label={t('main')} className="-mb-px flex overflow-x-auto">
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-11 items-center px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-signal after:opacity-0',
              'aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
