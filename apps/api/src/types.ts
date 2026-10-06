import type { Logger } from '@bot-arena/logger'
import type { SessionUser } from '@bot-arena/shared'

export type AppEnv = {
  Variables: {
    requestId: string
    logger: Logger
    /** Set by `requireAuth`. */
    user: SessionUser
  }
}
