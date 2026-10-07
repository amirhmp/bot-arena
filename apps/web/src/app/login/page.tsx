import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BracketArt } from '@/components/bracket-art'
import { BrandMark } from '@/components/brand-mark'
import { getSessionUser } from '@/lib/session'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  // Only same-site paths are allowed as a redirect target.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  if (await getSessionUser()) redirect(target)

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <aside className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-bold">
          <BrandMark />
          Bot Arena
        </div>
        <BracketArt className="w-full max-w-xl" />
        <p className="max-w-sm text-3xl leading-tight font-bold font-stretch-112%">
          Write bots, run tournaments.
        </p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-lg font-bold lg:hidden">
            <BrandMark className="text-primary" />
            Bot Arena
          </div>
          <h1 className="text-3xl">Sign in</h1>
          <p className="mt-1.5 text-muted-foreground">
            Use the account an admin created for you. If you do not have one, ask your admin.
          </p>
          <LoginForm next={target} />
        </div>
      </main>
    </div>
  )
}
