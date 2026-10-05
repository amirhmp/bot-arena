import type { ServiceHealth, SystemStatus } from '@bot-arena/shared'
import { Hono } from 'hono'
import type { AppEnv } from '../types'

export type StatusDeps = {
  pingDatabase: () => Promise<void>
  seqUrl?: string
}

async function measure(check: () => Promise<void>): Promise<ServiceHealth> {
  const started = performance.now()
  try {
    await check()
    return { status: 'ok', latencyMs: Math.round(performance.now() - started) }
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function pingSeq(seqUrl: string | undefined): Promise<void> {
  if (!seqUrl) throw new Error('SEQ_URL is not configured')
  const response = await fetch(`${seqUrl.replace(/\/$/, '')}/api`, {
    signal: AbortSignal.timeout(2000),
  })
  if (!response.ok) throw new Error(`Seq responded with ${response.status}`)
}

/**
 * System status. Open in development; from Phase 1 it moves behind the admin role.
 * The queue and sandbox checks are added in Phase 3.
 */
export function statusRoutes(deps: StatusDeps) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const [database, seq] = await Promise.all([
      measure(deps.pingDatabase),
      measure(() => pingSeq(deps.seqUrl)),
    ])
    const api: ServiceHealth = { status: 'ok', latencyMs: 0 }

    const body: SystemStatus = {
      status: [api, database, seq].every((s) => s.status === 'ok') ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      services: { api, database, seq },
    }
    c.get('logger').info(
      { status: body.status, database: database.status, seq: seq.status },
      'status checked',
    )
    return c.json(body)
  })
}
