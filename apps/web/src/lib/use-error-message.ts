'use client'

import { useTranslations } from 'next-intl'
import { ApiError } from './api'

/**
 * Turns anything thrown by a request into text for the user. The API's own message is shown as it
 * comes (the API is not translated yet); when there is none, a translated fallback is used.
 */
export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations('Errors')
  return (error) => {
    if (error instanceof ApiError) {
      return error.message || t('requestFailed', { status: error.status })
    }
    if (error instanceof Error && error.message) return error.message
    return t('unknown')
  }
}
