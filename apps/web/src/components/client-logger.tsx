'use client'

import { useEffect } from 'react'
import { installClientLogger } from '@/lib/client-logger'

/** Installs the browser logger for signed-in users (the log endpoint requires a session). */
export function ClientLogger() {
  useEffect(() => installClientLogger(), [])
  return null
}
