import type { Logger } from '@bot-arena/logger'

export type AppEnv = {
  Variables: {
    requestId: string
    logger: Logger
  }
}
