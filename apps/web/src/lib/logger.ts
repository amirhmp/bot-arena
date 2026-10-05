import 'server-only'
import { createLogger, resolveSeqUrl } from '@bot-arena/logger'

/** Server-side logger for the web app. Browser logs arrive in Phase 1 through the API. */
export const logger = createLogger({
  service: 'web',
  level: process.env.LOG_LEVEL,
  seqUrl: resolveSeqUrl(process.env),
})
