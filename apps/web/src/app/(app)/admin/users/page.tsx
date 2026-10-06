import { UsersView } from './users-view'

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Create accounts, set initial passwords and assign roles. There is no self-registration.
      </p>
      <UsersView />
    </div>
  )
}
