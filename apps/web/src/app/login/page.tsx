import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { BracketArt } from '@/components/bracket-art'
import { BrandMark } from '@/components/brand-mark'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { getSessionUser } from '@/lib/session'
import { LoginForm } from './login-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Login')
  return { title: t('metaTitle') }
}

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const t = await getTranslations('Login')
  const tApp = await getTranslations('App')
  // Only same-site paths are allowed as a redirect target.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  if (await getSessionUser()) redirect(target)

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <aside className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-bold">
          <BrandMark />
          {tApp('name')}
        </div>
        <BracketArt className="w-full max-w-xl" />
        <p className="max-w-sm text-3xl leading-tight font-bold font-stretch-112%">
          {tApp('tagline')}
        </p>
      </aside>
      <main className="relative flex items-center justify-center p-6">
        <div className="absolute end-4 top-4">
          <LocaleSwitcher />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-lg font-bold lg:hidden">
            <BrandMark className="text-primary" />
            {tApp('name')}
          </div>
          <h1 className="text-3xl">{t('title')}</h1>
          <p className="mt-1.5 text-muted-foreground">{t('intro')}</p>
          <LoginForm next={target} />
        </div>
      </main>
    </div>
  )
}
