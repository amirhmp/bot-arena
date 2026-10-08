'use client'

import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setLocale } from '@/i18n/actions'
import { isLocale, LOCALE_NAMES, LOCALES } from '@/lib/direction'

/** The language choices as radio items, to place inside any dropdown menu. */
export function LocaleRadioGroup() {
  const current = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Saves the language cookie, then re-renders the current page in the new language.
  const change = (value: string) => {
    if (!isLocale(value) || value === current) return
    startTransition(async () => {
      await setLocale(value)
      router.refresh()
    })
  }

  return (
    <DropdownMenuRadioGroup value={current} onValueChange={change}>
      {LOCALES.map((locale) => (
        // Each name is written in its own language, whatever the current UI language is.
        <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
          {LOCALE_NAMES[locale]}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

/** Standalone language menu, for screens without the account menu (the sign-in page). */
export function LocaleSwitcher() {
  const t = useTranslations('UserMenu')
  const current = useLocale()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('language')}>
          <Languages aria-hidden />
          <span lang={current}>{isLocale(current) ? LOCALE_NAMES[current] : current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <LocaleRadioGroup />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
