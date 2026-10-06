'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field, TextInput } from '@/components/ui'
import { authClient } from '@/lib/auth-client'

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    const { error } = await authClient.signIn.username({
      username: String(form.get('username') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    })
    if (error) {
      setError(error.message ?? 'Could not sign in')
      setPending(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field label="Username">
        <TextInput name="username" autoComplete="username" autoFocus required />
      </Field>
      <Field label="Password">
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
