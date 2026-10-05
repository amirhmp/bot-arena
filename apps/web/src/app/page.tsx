import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold">Bot Arena</h1>
      <p className="mt-2 text-neutral-500">Foundation is running.</p>
      <Link className="mt-6 inline-block underline" href="/status">
        System status
      </Link>
    </main>
  )
}
