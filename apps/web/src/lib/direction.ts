/**
 * Locales and text direction, kept in one place. Components use logical Tailwind classes
 * (`ms-*`, `ps-*`, `start-*`, `text-start`, `border-s`, ...) and never physical ones (`ml-*`,
 * `pr-*`, `left-*`, `text-left`), so flipping `dir` on <html> mirrors the whole UI. ESLint
 * enforces the class rule.
 *
 * Translations live in `apps/web/messages/<locale>.json` and are served by next-intl
 * (`src/i18n/request.ts`). To add a language: add it to `LOCALES` (and to `RTL_LOCALES` when it is
 * written right to left), add its native name to `LOCALE_NAMES`, and add a messages file.
 */
export const LOCALES = ['en', 'fa'] as const
export type Locale = (typeof LOCALES)[number]
export type Direction = 'ltr' | 'rtl'

export const DEFAULT_LOCALE: Locale = 'en'

/** Each language written in itself, so a reader can find theirs whatever the current UI language. */
export const LOCALE_NAMES = { en: 'English', fa: 'فارسی' } as const satisfies Record<Locale, string>

const RTL_LOCALES: readonly string[] = ['fa']

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function getDirection(locale: string): Direction {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
}
