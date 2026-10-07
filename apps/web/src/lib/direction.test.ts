import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, getDirection } from './direction'

describe('getDirection', () => {
  it('is ltr for the default locale', () => {
    expect(getDirection(DEFAULT_LOCALE)).toBe('ltr')
  })

  it('falls back to ltr for unknown locales', () => {
    expect(getDirection('xx')).toBe('ltr')
  })
})
