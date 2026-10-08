import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, getDirection, isLocale, LOCALES } from './direction'

describe('getDirection', () => {
  it('is ltr for the default locale', () => {
    expect(getDirection(DEFAULT_LOCALE)).toBe('ltr')
  })

  it('is rtl for Persian', () => {
    expect(getDirection('fa')).toBe('rtl')
  })

  it('falls back to ltr for unknown locales', () => {
    expect(getDirection('xx')).toBe('ltr')
  })
})

describe('isLocale', () => {
  it('accepts every supported locale', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isLocale('xx')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})
