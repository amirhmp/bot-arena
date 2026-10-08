import { describe, expect, it } from 'vitest'
import { negotiateLocale, resolveLocale } from './locale'

describe('negotiateLocale', () => {
  it('uses the default without a header', () => {
    expect(negotiateLocale(null)).toBe('en')
  })

  it('matches the primary subtag', () => {
    expect(negotiateLocale('fa-IR,fa;q=0.9,en;q=0.8')).toBe('fa')
  })

  it('honours quality values', () => {
    expect(negotiateLocale('fa;q=0.4,en;q=0.9')).toBe('en')
  })

  it('skips unsupported languages and falls back', () => {
    expect(negotiateLocale('de,fr;q=0.8')).toBe('en')
    expect(negotiateLocale('de,fa;q=0.5')).toBe('fa')
  })
})

describe('resolveLocale', () => {
  it('prefers a valid cookie over the header', () => {
    expect(resolveLocale('en', 'fa')).toBe('en')
  })

  it('ignores an invalid cookie', () => {
    expect(resolveLocale('xx', 'fa')).toBe('fa')
    expect(resolveLocale(undefined, null)).toBe('en')
  })
})
