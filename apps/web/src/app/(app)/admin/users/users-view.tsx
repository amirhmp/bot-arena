'use client'

import { PASSWORD_MIN_LENGTH, ROLES, type Role, type UserSummary } from '@bot-arena/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, MoreHorizontal, Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormError, SelectField, TextField } from '@/components/form-parts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createApiClient, readApiError } from '@/lib/api'
import { useErrorMessage } from '@/lib/use-error-message'

const USERS_KEY = ['users']

/** The role choices for a select, labelled in the current language. */
function useRoleOptions() {
  const t = useTranslations('Roles')
  return ROLES.map((role) => ({ value: role, label: t(role) }))
}

type DialogState = { kind: 'create' } | { kind: 'edit' | 'password'; user: UserSummary }

async function fetchUsers(): Promise<UserSummary[]> {
  const res = await createApiClient().users.$get({ query: {} })
  if (!res.ok) throw await readApiError(res)
  return (await res.json()).users
}

/** Throws the API's error message for a failed response, so mutations surface it. */
async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) throw await readApiError(res)
}

export function UsersView({ currentUserId }: { currentUserId: string }) {
  const t = useTranslations('Users')
  const tCommon = useTranslations('Common')
  const tRoles = useTranslations('Roles')
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  // `dialog` keeps its last value while the dialog animates closed; `dialogKey` resets the form.
  const [dialog, setDialog] = useState<DialogState>({ kind: 'create' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(0)
  const [deactivating, setDeactivating] = useState<UserSummary | null>(null)
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: USERS_KEY,
    queryFn: fetchUsers,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: USERS_KEY })

  function openDialog(next: DialogState) {
    setDialog(next)
    setDialogKey((key) => key + 1)
    setDialogOpen(true)
  }

  function closeDialog(message: string, description?: string) {
    setDialogOpen(false)
    toast.success(message, { description })
    void refresh()
  }

  const setActive = useMutation({
    mutationFn: async ({ user, active }: { user: UserSummary; active: boolean }) => {
      const api = createApiClient().users[':id']
      const res = active
        ? await api.activate.$post({ param: { id: user.id } })
        : await api.deactivate.$post({ param: { id: user.id } })
      await ensureOk(res)
    },
    onSuccess: (_result, { user, active }) => {
      setDeactivating(null)
      toast.success(active ? t('activated') : t('deactivatedToast'), { description: user.name })
      return refresh()
    },
    onError: (e) => toast.error(t('updateFailed'), { description: errorMessage(e) }),
  })

  if (isPending) return <UsersSkeleton />

  if (error) {
    return (
      <div className="grid justify-items-start gap-3">
        <FormError>{t('loadFailed', { detail: errorMessage(error) })}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          {tCommon('tryAgain')}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" data-numeric>
          {t('count', { count: data.length })}
        </p>
        <Button onClick={() => openDialog({ kind: 'create' })}>
          <Plus aria-hidden />
          {t('newUser')}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('colName')}</TableHead>
              <TableHead>{t('colUsername')}</TableHead>
              <TableHead>{t('colRole')}</TableHead>
              <TableHead>{t('colStatus')}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">{tCommon('actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((user) => {
              const isSelf = user.id === currentUserId
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {user.name}
                      {isSelf ? <Badge variant="outline">{t('you')}</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tRoles(user.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <Badge variant="success">{t('active')}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {t('deactivated')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t('actionsFor', { name: user.name })}
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openDialog({ kind: 'edit', user })}>
                          <Pencil aria-hidden />
                          {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openDialog({ kind: 'password', user })}>
                          <KeyRound aria-hidden />
                          {t('resetPassword')}
                        </DropdownMenuItem>
                        {/* The API refuses to deactivate yourself, so the option is not offered. */}
                        {!user.active || !isSelf ? <DropdownMenuSeparator /> : null}
                        {user.active ? (
                          isSelf ? null : (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeactivating(user)}
                            >
                              <UserX aria-hidden />
                              {t('deactivate')}
                            </DropdownMenuItem>
                          )
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => setActive.mutate({ user, active: true })}
                          >
                            <UserCheck aria-hidden />
                            {t('activate')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent key={dialogKey}>
          {dialog.kind === 'create' ? (
            <CreateUserForm onDone={(name) => closeDialog(t('created'), name)} />
          ) : dialog.kind === 'edit' ? (
            <EditUserForm
              user={dialog.user}
              isSelf={dialog.user.id === currentUserId}
              onDone={() => closeDialog(tCommon('changesSaved'))}
            />
          ) : (
            <ResetPasswordForm
              user={dialog.user}
              onDone={() => closeDialog(t('resetDone'), dialog.user.name)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null)
        }}
        title={
          deactivating
            ? t('deactivateTitle', { name: deactivating.name })
            : t('deactivateTitleFallback')
        }
        description={t('deactivateDescription')}
        confirmLabel={t('deactivateConfirm')}
        destructive
        pending={setActive.isPending}
        onConfirm={() => deactivating && setActive.mutate({ user: deactivating, active: false })}
      />
    </div>
  )
}

function UsersSkeleton() {
  const t = useTranslations('Users')
  return (
    <div className="grid gap-3" role="status" aria-label={t('loading')}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="divide-y rounded-lg border bg-card">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-6 px-3 py-3.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

function FormShell({
  title,
  description,
  error,
  pending,
  submitLabel,
  onSubmit,
  children,
}: {
  title: string
  description: string
  error: string
  pending: boolean
  submitLabel: string
  onSubmit: (form: FormData) => void
  children: ReactNode
}) {
  const tCommon = useTranslations('Common')
  return (
    <form
      className="grid gap-4"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        onSubmit(new FormData(e.currentTarget))
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
      <FormError>{error}</FormError>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{tCommon('cancel')}</Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

function CreateUserForm({ onDone }: { onDone: (name: string) => void }) {
  const t = useTranslations('Users')
  const errorMessage = useErrorMessage()
  const roleOptions = useRoleOptions()
  const [error, setError] = useState('')
  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const res = await createApiClient().users.$post({
        json: {
          username: String(form.get('username') ?? ''),
          name: String(form.get('name') ?? ''),
          password: String(form.get('password') ?? ''),
          role: String(form.get('role')) as Role,
        },
      })
      await ensureOk(res)
      return String(form.get('name') ?? '')
    },
    onSuccess: onDone,
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <FormShell
      title={t('createTitle')}
      description={t('createDescription')}
      error={error}
      pending={create.isPending}
      submitLabel={t('createSubmit')}
      onSubmit={(form) => {
        setError('')
        create.mutate(form)
      }}
    >
      <TextField
        label={t('usernameLabel')}
        name="username"
        hint={t('usernameHint')}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        minLength={3}
        maxLength={32}
      />
      <TextField label={t('nameLabel')} name="name" autoComplete="off" required maxLength={100} />
      <TextField
        label={t('createInitialPassword')}
        name="password"
        hint={t('passwordHint', { min: PASSWORD_MIN_LENGTH })}
        autoComplete="off"
        required
        minLength={PASSWORD_MIN_LENGTH}
      />
      <SelectField label={t('roleLabel')} name="role" defaultValue="player" options={roleOptions} />
    </FormShell>
  )
}

function EditUserForm({
  user,
  isSelf,
  onDone,
}: {
  user: UserSummary
  isSelf: boolean
  onDone: () => void
}) {
  const t = useTranslations('Users')
  const tCommon = useTranslations('Common')
  const errorMessage = useErrorMessage()
  const roleOptions = useRoleOptions()
  const [error, setError] = useState('')
  const update = useMutation({
    mutationFn: async (form: FormData) => {
      const res = await createApiClient().users[':id'].$patch({
        param: { id: user.id },
        json: {
          username: String(form.get('username') ?? ''),
          name: String(form.get('name') ?? ''),
          // A disabled select does not submit, so keep the current role.
          role: (form.get('role') as Role | null) ?? user.role,
        },
      })
      await ensureOk(res)
    },
    onSuccess: onDone,
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <FormShell
      title={t('editTitle', { name: user.name })}
      description={t('editDescription')}
      error={error}
      pending={update.isPending}
      submitLabel={tCommon('saveChanges')}
      onSubmit={(form) => {
        setError('')
        update.mutate(form)
      }}
    >
      <TextField
        label={t('usernameLabel')}
        name="username"
        defaultValue={user.username}
        autoCapitalize="none"
        spellCheck={false}
        required
        minLength={3}
        maxLength={32}
      />
      <TextField
        label={t('nameLabel')}
        name="name"
        defaultValue={user.name}
        required
        maxLength={100}
      />
      <SelectField
        label={t('roleLabel')}
        name="role"
        defaultValue={user.role}
        options={roleOptions}
        disabled={isSelf}
        hint={isSelf ? t('selfRoleHint') : undefined}
      />
    </FormShell>
  )
}

function ResetPasswordForm({ user, onDone }: { user: UserSummary; onDone: () => void }) {
  const t = useTranslations('Users')
  const errorMessage = useErrorMessage()
  const [error, setError] = useState('')
  const reset = useMutation({
    mutationFn: async (form: FormData) => {
      const res = await createApiClient().users[':id'].password.$post({
        param: { id: user.id },
        json: { password: String(form.get('password') ?? '') },
      })
      await ensureOk(res)
    },
    onSuccess: onDone,
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <FormShell
      title={t('resetTitle', { name: user.name })}
      description={t('resetDescription')}
      error={error}
      pending={reset.isPending}
      submitLabel={t('resetSubmit')}
      onSubmit={(form) => {
        setError('')
        reset.mutate(form)
      }}
    >
      <TextField
        label={t('resetNewPassword')}
        name="password"
        hint={t('passwordHint', { min: PASSWORD_MIN_LENGTH })}
        autoComplete="off"
        required
        minLength={PASSWORD_MIN_LENGTH}
      />
    </FormShell>
  )
}
