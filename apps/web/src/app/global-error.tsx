'use client'

import { ErrorFallback } from '@/components/error-fallback'

// Replaces the root layout when it crashes, so it renders its own <html>.
export default function GlobalError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <ErrorFallback {...props} />
      </body>
    </html>
  )
}
