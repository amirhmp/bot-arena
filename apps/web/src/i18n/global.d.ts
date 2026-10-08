import type { Locale } from '@/lib/direction'
import type messages from '../../messages/en.json'

// Makes `t('key')` type-checked against messages/en.json, and locale values against LOCALES.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: typeof messages
  }
}
