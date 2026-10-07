'use client'

import { ErrorFallback } from '@/components/error-fallback'
import { DEFAULT_LOCALE, getDirection } from '@/lib/direction'
import './styles'

// Replaces the root layout when it crashes, so it renders its own <html>.
export default function GlobalError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang={DEFAULT_LOCALE} dir={getDirection(DEFAULT_LOCALE)}>
      <body>
        <ErrorFallback {...props} />
      </body>
    </html>
  )
}
