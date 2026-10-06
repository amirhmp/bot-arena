import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { LoginForm } from './login-form'

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
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Bot Arena</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Sign in with the account an admin created for you.
      </p>
      <LoginForm next={target} />
    </main>
  )
}
