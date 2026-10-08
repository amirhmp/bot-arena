import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Next.js only reads .env from this app's folder. The single .env lives at the repo root,
// so load it here (existing environment variables are not overridden).
try {
  process.loadEnvFile(path.join(import.meta.dirname, '../../.env'))
} catch {
  // No root .env (for example in production, where variables come from the environment).
}

const nextConfig: NextConfig = {
  output: 'standalone',
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@bot-arena/logger', '@bot-arena/shared'],
  serverExternalPackages: ['pino'],
}

// next-intl: translations are resolved per request in src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
