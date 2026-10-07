'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { logBoundaryError } from '@/lib/client-logger'

/** Shared body for error boundaries: reports the error to Seq and offers a retry. */
export function ErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logBoundaryError(error)
  }, [error])

  return (
    <div role="alert" className="mx-auto max-w-md p-8 pt-24">
      <h1 className="text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page failed to load. The error was reported. Try again, and if it keeps happening, tell
        an admin.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
