import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/direction'
import { LOCALE_COOKIE, negotiateLocale } from './locale'

/**
 * The locale as the browser knows it (cookie, then browser languages). Only for `global-error`,
 * which replaces the root layout and therefore has no server-provided locale.
 */
export function readBrowserLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const prefix = `${LOCALE_COOKIE}=`
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length)
  return isLocale(value) ? value : negotiateLocale(navigator.languages.join(','))
}
