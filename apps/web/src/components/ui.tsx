import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export const inputClass =
  'w-full rounded border border-neutral-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700'

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-neutral-500">{hint}</span> : null}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Button({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
    secondary: 'border border-neutral-300 dark:border-neutral-700',
    danger: 'border border-red-500 text-red-600 dark:text-red-400',
  }[variant]
  return (
    <button
      type="button"
      {...props}
      className={`rounded px-3 py-1.5 text-sm disabled:opacity-50 ${styles} ${props.className ?? ''}`}
    />
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  )
}
