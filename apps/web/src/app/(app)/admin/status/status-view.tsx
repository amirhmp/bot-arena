'use client'

import type { ServiceHealth, SystemStatus } from '@bot-arena/shared'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, RefreshCw } from 'lucide-react'
import { FormError } from '@/components/form-parts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createApiClient } from '@/lib/api'

async function fetchStatus(): Promise<SystemStatus> {
  const res = await createApiClient().status.$get()
  if (!res.ok) throw new Error(`API responded with ${res.status}`)
  return res.json()
}

const LABELS = { api: 'API', database: 'Database', seq: 'Log server (Seq)' } as const

function Row({ name, health }: { name: string; health: ServiceHealth }) {
  const ok = health.status === 'ok'
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="font-medium">{name}</span>
      <span className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground" data-numeric>
          {ok ? `${health.latencyMs} ms` : (health.error ?? 'No response')}
        </span>
        {/* Status is text and an icon as well as color. */}
        <Badge variant={ok ? 'success' : 'destructive'}>
          {ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
          {ok ? 'Healthy' : 'Down'}
        </Badge>
      </span>
    </li>
  )
}

export function StatusView() {
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['system-status'],
    queryFn: fetchStatus,
    refetchInterval: 10_000,
  })

  if (isPending) {
    return (
      <div
        className="divide-y rounded-lg border bg-card"
        role="status"
        aria-label="Checking services"
      >
        {Object.keys(LABELS).map((key) => (
          <div key={key} className="flex items-center justify-between px-5 py-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid justify-items-start gap-3">
        <FormError>Cannot reach the API: {error.message}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  const keys = Object.keys(LABELS) as (keyof typeof LABELS)[]
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-sm">
          Overall
          <Badge variant={data.status === 'ok' ? 'success' : 'destructive'}>
            {data.status === 'ok' ? 'All systems healthy' : 'Degraded'}
          </Badge>
        </p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isFetching}>
          {isFetching ? null : <RefreshCw aria-hidden />}
          Check now
        </Button>
      </div>
      <ul className="divide-y rounded-lg border bg-card">
        {keys.map((key) => (
          <Row key={key} name={LABELS[key]} health={data.services[key]} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Last checked {new Date(dataUpdatedAt).toLocaleTimeString()}
      </p>
    </div>
  )
}
