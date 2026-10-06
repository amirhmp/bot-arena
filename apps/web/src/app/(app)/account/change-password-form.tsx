'use client'

import { PASSWORD_MIN_LENGTH } from '@bot-arena/shared'
import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field, TextInput } from '@/components/ui'
import { authClient } from '@/lib/auth-client'

export function ChangePasswordForm() {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const next = String(form.get('newPassword') ?? '')
    setDone(false)
    setError('')
    if (next !== String(form.get('confirm') ?? '')) {
      setError('The new passwords do not match')
      return
    }
    setPending(true)
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get('currentPassword') ?? ''),
      newPassword: next,
      revokeOtherSessions: true,
    })
    setPending(false)
    if (error) {
      setError(error.message ?? 'Could not change the password')
      return
    }
    formElement.reset()
    setDone(true)
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-4">
      <Field label="Current password">
        <TextInput
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field label="New password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
        <TextInput
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
      </Field>
      <Field label="Repeat new password">
        <TextInput name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <ErrorText>{error}</ErrorText>
      {done ? (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">
          Password changed. Your other sessions were signed out.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  )
}
