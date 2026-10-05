import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client'

export { PrismaClient }

/** Prisma 7 requires a driver adapter; the connection string is passed to it directly. */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

/** Returns true when a trivial query succeeds. Used by the status route. */
export async function pingDatabase(client: PrismaClient): Promise<void> {
  await client.$queryRaw`SELECT 1`
}
