import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from '../lib/direction'

/** Cookie that stores the chosen UI language. Read on the server, written by `setLocale`. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

/**
 * Picks the locale from an `Accept-Language` header: the first listed language whose primary
 * subtag is supported ("fa-IR,fa;q=0.9,en;q=0.8" gives `fa`). Used only until the user chooses.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.find((param) => param.trim().startsWith('q='))
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1 }
    })
    .filter((entry) => entry.tag !== '' && entry.q > 0)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of ranked) {
    const primary = tag.split('-')[0]
    const match = LOCALES.find((locale) => locale === primary)
    if (match) return match
  }
  return DEFAULT_LOCALE
}

/** The locale to use given the cookie value and the `Accept-Language` header. */
export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  return isLocale(cookie) ? cookie : negotiateLocale(acceptLanguage)
}
