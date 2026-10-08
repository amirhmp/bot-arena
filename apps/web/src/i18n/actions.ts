'use server'

import { cookies } from 'next/headers'
import { isLocale } from '@/lib/direction'
import { LOCALE_COOKIE } from './locale'

/** Stores the chosen UI language for a year. The caller refreshes the router afterwards. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return
  ;(await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
