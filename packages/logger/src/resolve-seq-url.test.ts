import { describe, expect, it } from 'vitest'
import { resolveSeqUrl } from './index'

describe('resolveSeqUrl', () => {
  it('prefers SEQ_URL', () => {
    expect(resolveSeqUrl({ SEQ_URL: 'http://seq:5341', SEQ_INGESTION_PORT: '5999' })).toBe(
      'http://seq:5341',
    )
  })

  it('builds the development URL from SEQ_INGESTION_PORT', () => {
    expect(resolveSeqUrl({ SEQ_INGESTION_PORT: '5999' })).toBe('http://localhost:5999')
  })

  it('returns undefined when nothing is configured', () => {
    expect(resolveSeqUrl({})).toBeUndefined()
  })
})
