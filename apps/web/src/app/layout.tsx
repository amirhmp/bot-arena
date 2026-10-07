import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { DEFAULT_LOCALE, getDirection } from '@/lib/direction'
import { Providers } from './providers'
import './styles'

export const metadata: Metadata = {
  title: { default: 'Bot Arena', template: '%s · Bot Arena' },
  description: 'Write bots, run tournaments.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // One place decides the language and direction. See lib/direction.ts to add RTL.
  const locale = DEFAULT_LOCALE
  const dir = getDirection(locale)
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        <Providers dir={dir}>{children}</Providers>
      </body>
    </html>
  )
}
