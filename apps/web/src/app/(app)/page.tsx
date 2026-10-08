import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { getSessionUser } from '@/lib/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Home')
  return { title: t('metaTitle') }
}

export default async function HomePage() {
  const t = await getTranslations('Home')
  const user = await getSessionUser()
  const isAdmin = user?.role === 'admin'
  const adminLinks = [
    { href: '/admin/questions', title: t('questionsTitle'), text: t('questionsText') },
    { href: '/admin/users', title: t('usersTitle'), text: t('usersText') },
    { href: '/admin/status', title: t('statusTitle'), text: t('statusText') },
  ]
  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        title={t('welcome', { name: user?.name ?? '' })}
        description={isAdmin ? t('adminIntro') : undefined}
      />
      {isAdmin ? (
        <ul className="divide-y rounded-lg border bg-card">
          {adminLinks.map((link) => (
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
          <h2 className="text-lg">{t('emptyTitle')}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t('emptyText')}</p>
        </div>
      )}
    </div>
  )
}
