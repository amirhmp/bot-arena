'use client'

import { useEffect } from 'react'
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
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-neutral-500">The error was reported. You can try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Try again
      </button>
    </div>
  )
}
