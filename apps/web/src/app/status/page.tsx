import { logger } from '@/lib/logger'
import { StatusView } from './status-view'

// Never prerender: the log line below should appear for every visit.
export const dynamic = 'force-dynamic'

export default function StatusPage() {
  logger.info({ page: '/status' }, 'status page rendered')
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">System status</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Open in development only. From Phase 1 it requires the admin role.
      </p>
      <StatusView />
    </main>
  )
}
