'use client'

import { PASSWORD_MIN_LENGTH } from '@bot-arena/shared'
import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/form-parts'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export function ChangePasswordForm() {
  const t = useTranslations('ChangePassword')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const next = String(form.get('newPassword') ?? '')
    setError('')
    if (next !== String(form.get('confirm') ?? '')) {
      setError(t('mismatch'))
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
      setError(error.message || t('failed'))
      return
    }
    formElement.reset()
    toast.success(t('successTitle'), { description: t('successDescription') })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <TextField
        label={t('currentPassword')}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
      />
      <TextField
        label={t('newPassword')}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint={t('newPasswordHint', { min: PASSWORD_MIN_LENGTH })}
        minLength={PASSWORD_MIN_LENGTH}
        required
      />
      <TextField
        label={t('repeatPassword')}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <FormError>{error}</FormError>
      <div>
        <Button type="submit" loading={pending}>
          {pending ? t('saving') : t('submit')}
        </Button>
      </div>
    </form>
  )
}
