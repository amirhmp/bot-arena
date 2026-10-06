import { logger } from '@/lib/logger'
import { StatusView } from './status-view'

// Never prerender: the log line below should appear for every visit.
export const dynamic = 'force-dynamic'

export default function StatusPage() {
  logger.info({ page: '/admin/status' }, 'status page rendered')
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">System status</h1>
      <p className="mt-1 text-sm text-neutral-500">Admins only.</p>
      <StatusView />
    </div>
  )
}
