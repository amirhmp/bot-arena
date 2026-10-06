'use client'

import { ROLES, type Role, type UserSummary } from '@bot-arena/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field, inputClass, TextInput } from '@/components/ui'
import { createApiClient, readApiError } from '@/lib/api'

const USERS_KEY = ['users']

type Dialog = { kind: 'create' } | { kind: 'edit' | 'password'; user: UserSummary } | null

async function fetchUsers(): Promise<UserSummary[]> {
  const res = await createApiClient().users.$get({ query: {} })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()).users
}

/** Throws the API's error message for a failed response, so mutations surface it. */
async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await readApiError(res))
}

export function UsersView() {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [actionError, setActionError] = useState('')
  const { data, error, isPending } = useQuery({ queryKey: USERS_KEY, queryFn: fetchUsers })

  const refresh = () => queryClient.invalidateQueries({ queryKey: USERS_KEY })

  const toggleActive = useMutation({
    mutationFn: async (user: UserSummary) => {
      const api = createApiClient().users[':id']
      const res = user.active
        ? await api.deactivate.$post({ param: { id: user.id } })
        : await api.activate.$post({ param: { id: user.id } })
      await ensureOk(res)
    },
    onSuccess: () => {
      setActionError('')
      return refresh()
    },
    onError: (e) => setActionError(e.message),
  })

  if (isPending) return <p className="mt-6">Loading…</p>
  if (error) {
    return (
      <p role="alert" className="mt-6 text-red-600 dark:text-red-400">
        Could not load users: {error.message}
      </p>
    )
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-neutral-500">{data.length} users</p>
        <Button onClick={() => setDialog({ kind: 'create' })}>New user</Button>
      </div>
      <ErrorText>{actionError}</ErrorText>
      <div className="overflow-x-auto rounded border border-neutral-300 dark:border-neutral-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="p-2">Username</th>
              <th className="p-2">Name</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((user) => (
              <tr key={user.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="p-2 font-mono">{user.username}</td>
                <td className="p-2">{user.name}</td>
                <td className="p-2">{user.role}</td>
                <td className="p-2">
                  {user.active ? 'Active' : <span className="text-red-600">Deactivated</span>}
                </td>
                <td className="flex justify-end gap-2 p-2">
                  <Button variant="secondary" onClick={() => setDialog({ kind: 'edit', user })}>
                    Edit
                  </Button>
                  <Button variant="secondary" onClick={() => setDialog({ kind: 'password', user })}>
                    Reset password
                  </Button>
                  <Button
                    variant={user.active ? 'danger' : 'secondary'}
                    disabled={toggleActive.isPending}
                    onClick={() => toggleActive.mutate(user)}
                  >
                    {user.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog ? (
        <Modal onClose={() => setDialog(null)}>
          {dialog.kind === 'create' ? (
            <CreateUserForm
              onDone={() => {
                setDialog(null)
                void refresh()
              }}
              onCancel={() => setDialog(null)}
            />
          ) : dialog.kind === 'edit' ? (
            <EditUserForm
              user={dialog.user}
              onDone={() => {
                setDialog(null)
                void refresh()
              }}
              onCancel={() => setDialog(null)}
            />
          ) : (
            <ResetPasswordForm
              user={dialog.user}
              onDone={() => setDialog(null)}
              onCancel={() => setDialog(null)}
            />
          )}
        </Modal>
      ) : null}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded bg-white p-5 shadow-lg dark:bg-neutral-900"
      >
        {children}
      </div>
    </div>
  )
}

type FormProps = { onDone: () => void; onCancel: () => void }

function RoleSelect({ defaultValue }: { defaultValue: Role }) {
  return (
    <Field label="Role">
      <select name="role" defaultValue={defaultValue} className={inputClass}>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    </Field>
  )
}

function FormActions({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean
  submitLabel: string
  onCancel: () => void
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </div>
  )
}

function CreateUserForm({ onDone, onCancel }: FormProps) {
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
    },
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        create.mutate(new FormData(e.currentTarget))
      }}
    >
      <h2 className="text-lg font-semibold">New user</h2>
      <Field label="Username" hint="Letters, digits, dots and underscores. Used to sign in.">
        <TextInput name="username" autoComplete="off" required minLength={3} maxLength={32} />
      </Field>
      <Field label="Name">
        <TextInput name="name" required maxLength={100} />
      </Field>
      <Field
        label="Initial password"
        hint="At least 8 characters. Share it with the user directly."
      >
        <TextInput name="password" type="text" autoComplete="off" required minLength={8} />
      </Field>
      <RoleSelect defaultValue="player" />
      <ErrorText>{error}</ErrorText>
      <FormActions pending={create.isPending} submitLabel="Create user" onCancel={onCancel} />
    </form>
  )
}

function EditUserForm({ user, onDone, onCancel }: FormProps & { user: UserSummary }) {
  const [error, setError] = useState('')
  const update = useMutation({
    mutationFn: async (form: FormData) => {
      const res = await createApiClient().users[':id'].$patch({
        param: { id: user.id },
        json: {
          username: String(form.get('username') ?? ''),
          name: String(form.get('name') ?? ''),
          role: String(form.get('role')) as Role,
        },
      })
      await ensureOk(res)
    },
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        update.mutate(new FormData(e.currentTarget))
      }}
    >
      <h2 className="text-lg font-semibold">Edit {user.username}</h2>
      <Field label="Username">
        <TextInput
          name="username"
          defaultValue={user.username}
          required
          minLength={3}
          maxLength={32}
        />
      </Field>
      <Field label="Name">
        <TextInput name="name" defaultValue={user.name} required maxLength={100} />
      </Field>
      <RoleSelect defaultValue={user.role} />
      <ErrorText>{error}</ErrorText>
      <FormActions pending={update.isPending} submitLabel="Save" onCancel={onCancel} />
    </form>
  )
}

function ResetPasswordForm({ user, onDone, onCancel }: FormProps & { user: UserSummary }) {
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
    <form
      className="space-y-4"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        reset.mutate(new FormData(e.currentTarget))
      }}
    >
      <h2 className="text-lg font-semibold">Reset password for {user.username}</h2>
      <p className="text-sm text-neutral-500">The user is signed out everywhere.</p>
      <Field label="New password" hint="At least 8 characters.">
        <TextInput name="password" type="text" autoComplete="off" required minLength={8} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <FormActions pending={reset.isPending} submitLabel="Reset password" onCancel={onCancel} />
    </form>
  )
}
