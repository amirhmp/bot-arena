'use client'

import { PASSWORD_MIN_LENGTH } from '@bot-arena/shared'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/form-parts'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export function ChangePasswordForm() {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const next = String(form.get('newPassword') ?? '')
    setError('')
    if (next !== String(form.get('confirm') ?? '')) {
      setError('The new passwords do not match.')
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
      setError(error.message ?? 'Could not change the password.')
      return
    }
    formElement.reset()
    toast.success('Password changed', { description: 'Your other sessions were signed out.' })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <TextField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
      />
      <TextField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        minLength={PASSWORD_MIN_LENGTH}
        required
      />
      <TextField
        label="Repeat new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <FormError>{error}</FormError>
      <div>
        <Button type="submit" loading={pending}>
          {pending ? 'Saving…' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
