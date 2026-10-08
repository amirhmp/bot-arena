'use client'

import { NextIntlClientProvider } from 'next-intl'
import { useSyncExternalStore } from 'react'
import { ErrorFallback } from '@/components/error-fallback'
import { readBrowserLocale } from '@/i18n/client-locale'
import { DEFAULT_LOCALE, getDirection } from '@/lib/direction'
import en from '../../messages/en.json'
import fa from '../../messages/fa.json'
import './styles'

const MESSAGES = { en, fa }

const subscribe = () => () => {}

// Replaces the root layout when it crashes, so it renders its own <html> and has no server
// locale: it reads the language cookie in the browser (the server render uses the default).
export default function GlobalError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = useSyncExternalStore(subscribe, readBrowserLocale, () => DEFAULT_LOCALE)
  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
          <ErrorFallback {...props} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
