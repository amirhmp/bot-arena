'use client'

import { ROLES, type Role, type UserSummary } from '@bot-arena/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, MoreHorizontal, Pencil, Plus, UserCheck, UserX } from 'lucide-react'
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

const USERS_KEY = ['users']

const ROLE_LABEL = { admin: 'Admin', player: 'Player' } as const satisfies Record<Role, string>
const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }))

type DialogState = { kind: 'create' } | { kind: 'edit' | 'password'; user: UserSummary }

async function fetchUsers(): Promise<UserSummary[]> {
  const res = await createApiClient().users.$get({ query: {} })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()).users
}

/** Throws the API's error message for a failed response, so mutations surface it. */
async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await readApiError(res))
}

export function UsersView({ currentUserId }: { currentUserId: string }) {
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
      toast.success(active ? 'User activated' : 'User deactivated', { description: user.name })
      return refresh()
    },
    onError: (e) => toast.error('Could not update the user', { description: e.message }),
  })

  if (isPending) return <UsersSkeleton />

  if (error) {
    return (
      <div className="grid justify-items-start gap-3">
        <FormError>Could not load users: {error.message}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" data-numeric>
          {data.length === 1 ? '1 user' : `${data.length} users`}
        </p>
        <Button onClick={() => openDialog({ kind: 'create' })}>
          <Plus aria-hidden />
          New user
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
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
                      {isSelf ? <Badge variant="outline">You</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Deactivated
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
                          aria-label={`Actions for ${user.name}`}
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openDialog({ kind: 'edit', user })}>
                          <Pencil aria-hidden />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openDialog({ kind: 'password', user })}>
                          <KeyRound aria-hidden />
                          Reset password
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
                              Deactivate
                            </DropdownMenuItem>
                          )
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => setActive.mutate({ user, active: true })}
                          >
                            <UserCheck aria-hidden />
                            Activate
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
            <CreateUserForm onDone={(name) => closeDialog('User created', name)} />
          ) : dialog.kind === 'edit' ? (
            <EditUserForm
              user={dialog.user}
              isSelf={dialog.user.id === currentUserId}
              onDone={() => closeDialog('Changes saved')}
            />
          ) : (
            <ResetPasswordForm
              user={dialog.user}
              onDone={() => closeDialog('Password reset', dialog.user.name)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null)
        }}
        title={`Deactivate ${deactivating?.name ?? 'this user'}?`}
        description="They will be signed out right away and cannot sign in until you activate them again. Their data is kept."
        confirmLabel="Deactivate user"
        destructive
        pending={setActive.isPending}
        onConfirm={() => deactivating && setActive.mutate({ user: deactivating, active: false })}
      />
    </div>
  )
}

function UsersSkeleton() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading users">
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
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

function CreateUserForm({ onDone }: { onDone: (name: string) => void }) {
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
    onError: (e) => setError(e.message),
  })

  return (
    <FormShell
      title="New user"
      description="They sign in with these details. Share the password with them directly."
      error={error}
      pending={create.isPending}
      submitLabel="Create user"
      onSubmit={(form) => {
        setError('')
        create.mutate(form)
      }}
    >
      <TextField
        label="Username"
        name="username"
        hint="Lowercase letters, digits, dots and underscores."
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        minLength={3}
        maxLength={32}
      />
      <TextField label="Name" name="name" autoComplete="off" required maxLength={100} />
      <TextField
        label="Initial password"
        name="password"
        hint="At least 8 characters. Shown as you type so you can pass it on."
        autoComplete="off"
        required
        minLength={8}
      />
      <SelectField label="Role" name="role" defaultValue="player" options={ROLE_OPTIONS} />
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
    onError: (e) => setError(e.message),
  })

  return (
    <FormShell
      title={`Edit ${user.name}`}
      description="Changing the username changes how they sign in."
      error={error}
      pending={update.isPending}
      submitLabel="Save changes"
      onSubmit={(form) => {
        setError('')
        update.mutate(form)
      }}
    >
      <TextField
        label="Username"
        name="username"
        defaultValue={user.username}
        autoCapitalize="none"
        spellCheck={false}
        required
        minLength={3}
        maxLength={32}
      />
      <TextField label="Name" name="name" defaultValue={user.name} required maxLength={100} />
      <SelectField
        label="Role"
        name="role"
        defaultValue={user.role}
        options={ROLE_OPTIONS}
        disabled={isSelf}
        hint={isSelf ? 'You cannot change your own role.' : undefined}
      />
    </FormShell>
  )
}

function ResetPasswordForm({ user, onDone }: { user: UserSummary; onDone: () => void }) {
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
    onError: (e) => setError(e.message),
  })

  return (
    <FormShell
      title={`Reset password for ${user.name}`}
      description="They are signed out everywhere and must use the new password."
      error={error}
      pending={reset.isPending}
      submitLabel="Reset password"
      onSubmit={(form) => {
        setError('')
        reset.mutate(form)
      }}
    >
      <TextField
        label="New password"
        name="password"
        hint="At least 8 characters. Shown as you type so you can pass it on."
        autoComplete="off"
        required
        minLength={8}
      />
    </FormShell>
  )
}
