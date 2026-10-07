import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { logger } from '@/lib/logger'
import { StatusView } from './status-view'

export const metadata: Metadata = { title: 'Status' }

// Never prerender: the log line below should appear for every visit.
export const dynamic = 'force-dynamic'

export default function StatusPage() {
  logger.info({ page: '/admin/status' }, 'status page rendered')
  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <PageHeader
        title="System status"
        description="Checks the API, the database and the log server every 10 seconds."
      />
      <StatusView />
    </div>
  )
}
