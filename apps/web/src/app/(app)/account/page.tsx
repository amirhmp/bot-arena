import { ChangePasswordForm } from './change-password-form'

export default function AccountPage() {
  return (
    <div className="max-w-sm">
      <h1 className="text-2xl font-semibold">Account</h1>
      <h2 className="mt-6 text-lg font-medium">Change password</h2>
      <ChangePasswordForm />
    </div>
  )
}
