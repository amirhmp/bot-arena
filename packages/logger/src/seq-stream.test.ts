import { describe, expect, it } from 'vitest'
import { toClef } from './seq-stream'

describe('toClef', () => {
  it('maps Pino fields to CLEF', () => {
    const clef = toClef({
      level: 50,
      time: Date.UTC(2026, 0, 1),
      msg: 'boom',
      service: 'api',
      requestId: 'r1',
    })
    expect(clef).toMatchObject({
      '@t': '2026-01-01T00:00:00.000Z',
      '@mt': 'boom',
      '@l': 'Error',
      service: 'api',
      requestId: 'r1',
    })
  })

  it('maps the error stack to @x', () => {
    const clef = toClef({ level: 50, msg: 'x', err: { message: 'm', stack: 'stack' } })
    expect(clef['@x']).toBe('stack')
  })
})
