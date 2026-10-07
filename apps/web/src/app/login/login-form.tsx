'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { FormError, TextField } from '@/components/form-parts'
import { Button } from '@/components/ui/button'
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
      setError(error.message ?? 'Could not sign in. Check your username and password.')
      setPending(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5">
      <TextField
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        required
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" loading={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
