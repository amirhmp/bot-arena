import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { getDirection } from '@/lib/direction'
import { Providers } from './providers'
import './styles'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('App')
  return {
    title: { default: t('name'), template: `%s · ${t('name')}` },
    description: t('tagline'),
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // One place decides the language and direction (locale from the cookie, see i18n/request.ts).
  const locale = await getLocale()
  const dir = getDirection(locale)
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
