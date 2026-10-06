import { describe, expect, it } from 'vitest'
import { clientLogEventSchema, utf8ByteLength } from './client-log'

describe('utf8ByteLength', () => {
  it('counts bytes, not characters', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('é')).toBe(2)
    expect(utf8ByteLength('€')).toBe(3)
    expect(utf8ByteLength('😀')).toBe(4)
  })
})

describe('clientLogEventSchema', () => {
  it('limits the message by bytes', () => {
    const ok = { level: 'info', message: 'x'.repeat(2048) }
    expect(clientLogEventSchema.safeParse(ok).success).toBe(true)
    // 1025 two-byte characters is 2050 bytes.
    expect(clientLogEventSchema.safeParse({ ...ok, message: 'é'.repeat(1025) }).success).toBe(false)
  })
})
