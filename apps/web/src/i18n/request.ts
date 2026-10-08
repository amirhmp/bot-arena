import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale } from './locale'

/**
 * Runs once per request. There are no locale prefixes in URLs: the language comes from the
 * `NEXT_LOCALE` cookie (set by the language switcher) and falls back to the browser's
 * `Accept-Language` header, then to English.
 */
export default getRequestConfig(async () => {
  const locale = resolveLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    (await headers()).get('accept-language'),
  )
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
