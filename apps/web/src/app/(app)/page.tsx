import { getSessionUser } from '@/lib/session'

export default async function HomePage() {
  const user = await getSessionUser()
  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome, {user?.name}</h1>
      <p className="mt-2 text-neutral-500">
        {user?.role === 'admin'
          ? 'You can manage users from the Users page. Quizzes and contests arrive in later phases.'
          : 'Quizzes and contests assigned to you will appear here.'}
      </p>
    </div>
  )
}
