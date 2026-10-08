'use client'

import type { ServiceHealth, SystemStatus } from '@bot-arena/shared'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, RefreshCw } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { FormError } from '@/components/form-parts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createApiClient } from '@/lib/api'

const SERVICES = ['api', 'database', 'seq'] as const
const SERVICE_KEY = {
  api: 'serviceApi',
  database: 'serviceDatabase',
  seq: 'serviceSeq',
} as const satisfies Record<(typeof SERVICES)[number], string>

function Row({ name, health }: { name: string; health: ServiceHealth }) {
  const t = useTranslations('Status')
  const ok = health.status === 'ok'
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="font-medium">{name}</span>
      <span className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground" data-numeric>
          {ok ? t('latency', { ms: health.latencyMs }) : (health.error ?? t('noResponse'))}
        </span>
        {/* Status is text and an icon as well as color. */}
        <Badge variant={ok ? 'success' : 'destructive'}>
          {ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
          {ok ? t('healthy') : t('down')}
        </Badge>
      </span>
    </li>
  )
}

export function StatusView() {
  const t = useTranslations('Status')
  const tCommon = useTranslations('Common')
  const format = useFormatter()
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['system-status'],
    queryFn: async (): Promise<SystemStatus> => {
      const res = await createApiClient().status.$get()
      if (!res.ok) throw new Error(t('apiResponded', { status: res.status }))
      return res.json()
    },
    refetchInterval: 10_000,
  })

  if (isPending) {
    return (
      <div className="divide-y rounded-lg border bg-card" role="status" aria-label={t('checking')}>
        {SERVICES.map((key) => (
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
        <FormError>{t('unreachable', { detail: error.message })}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          {tCommon('tryAgain')}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-sm">
          {t('overall')}
          <Badge variant={data.status === 'ok' ? 'success' : 'destructive'}>
            {data.status === 'ok' ? t('allHealthy') : t('degraded')}
          </Badge>
        </p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isFetching}>
          {isFetching ? null : <RefreshCw aria-hidden />}
          {t('checkNow')}
        </Button>
      </div>
      <ul className="divide-y rounded-lg border bg-card">
        {SERVICES.map((key) => (
          <Row key={key} name={t(SERVICE_KEY[key])} health={data.services[key]} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {t('lastChecked', { time: format.dateTime(dataUpdatedAt, { timeStyle: 'medium' }) })}
      </p>
    </div>
  )
}
