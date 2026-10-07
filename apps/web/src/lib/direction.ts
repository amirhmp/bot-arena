/**
 * Text direction, kept in one place so RTL (Persian) can be switched on later without touching
 * components. Components use logical Tailwind classes (`ms-*`, `ps-*`, `start-*`, `text-start`,
 * `border-s`, ...) and never physical ones (`ml-*`, `pr-*`, `left-*`, `text-left`), so flipping
 * `dir` on <html> mirrors the whole UI. ESLint enforces the class rule.
 *
 * Today the app ships English only. To add Persian: add the locale below, read the user's locale
 * in `app/layout.tsx` (cookie or setting) and pass it to `getDirection`. Text still has to be
 * translated; this file only covers direction.
 */
export const LOCALES = ['en'] as const
export type Locale = (typeof LOCALES)[number]
export type Direction = 'ltr' | 'rtl'

export const DEFAULT_LOCALE: Locale = 'en'

// Add 'fa' here when Persian is supported.
const RTL_LOCALES: readonly string[] = []

export function getDirection(locale: string): Direction {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
}
