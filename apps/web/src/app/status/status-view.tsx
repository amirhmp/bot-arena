'use client'

import type { ServiceHealth, SystemStatus } from '@bot-arena/shared'
import { useQuery } from '@tanstack/react-query'
import { createApiClient } from '@/lib/api'

async function fetchStatus(): Promise<SystemStatus> {
  const res = await createApiClient().status.$get()
  if (!res.ok) throw new Error(`API responded with ${res.status}`)
  return res.json()
}

const LABELS = { api: 'API', database: 'Database', seq: 'Seq' } as const

function Row({ name, health }: { name: string; health: ServiceHealth }) {
  const ok = health.status === 'ok'
  return (
    <li className="flex items-center justify-between rounded border border-neutral-300 p-3 dark:border-neutral-700">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="font-medium">{name}</span>
      </span>
      <span className="text-sm text-neutral-500">
        {ok ? `healthy · ${health.latencyMs} ms` : (health.error ?? 'down')}
      </span>
    </li>
  )
}

export function StatusView() {
  const { data, error, isPending } = useQuery({
    queryKey: ['system-status'],
    queryFn: fetchStatus,
    refetchInterval: 10_000,
  })

  if (isPending) return <p className="mt-6">Checking…</p>
  if (error) {
    return (
      <p className="mt-6 text-red-500" role="alert">
        Cannot reach the API: {error.message}
      </p>
    )
  }

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm">
        Overall: <strong>{data.status}</strong> · checked{' '}
        {new Date(data.checkedAt).toLocaleTimeString()}
      </p>
      <ul className="space-y-2">
        {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((key) => (
          <Row key={key} name={LABELS[key]} health={data.services[key]} />
        ))}
      </ul>
    </div>
  )
}
