import { createTranslator } from 'next-intl'
import { describe, expect, it } from 'vitest'
import { LOCALES } from '../src/lib/direction'
import en from './en.json'
import fa from './fa.json'

const MESSAGES = { en, fa } as const

type Tree = { [key: string]: string | Tree }

/** Flattens `{ A: { b: 'x' } }` into `{ 'A.b': 'x' }`. */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix + key
    if (typeof value === 'string') out[path] = value
    else Object.assign(out, flatten(value, `${path}.`))
  }
  return out
}

/** The argument names a message uses: `{name}`, `{n, number}` and `{count, plural, ...}`. */
function argumentNames(message: string): string[] {
  const names = new Set<string>()
  for (const match of message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)) names.add(match[1] as string)
  return [...names].sort()
}

const reference = flatten(en)

describe('messages', () => {
  it('has a file for every locale', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LOCALES].sort())
  })

  for (const locale of LOCALES) {
    describe(locale, () => {
      const messages = flatten(MESSAGES[locale])

      it('has exactly the keys of en.json', () => {
        expect(Object.keys(messages).sort()).toEqual(Object.keys(reference).sort())
      })

      it('has no empty messages', () => {
        for (const [key, value] of Object.entries(messages)) {
          expect(value.trim(), key).not.toBe('')
        }
      })

      it('uses the same arguments as en.json', () => {
        for (const [key, value] of Object.entries(messages)) {
          expect(argumentNames(value), key).toEqual(argumentNames(reference[key] as string))
        }
      })

      it('is valid ICU: every message formats without errors', () => {
        const errors: string[] = []
        const t = createTranslator({
          locale,
          messages: MESSAGES[locale],
          onError: (error) => errors.push(error.message),
        }) as unknown as (key: string, values: Record<string, unknown>) => string
        for (const [key, value] of Object.entries(messages)) {
          const values = Object.fromEntries(argumentNames(value).map((name) => [name, 1]))
          expect(t(key, values), key).not.toBe('')
        }
        expect(errors).toEqual([])
      })
    })
  }
})
