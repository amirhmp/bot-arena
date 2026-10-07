'use client'

import { CircleAlert, Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** A label, an input and an optional hint, wired together for screen readers. */
export function TextField({
  label,
  hint,
  type,
  ...props
}: { label: string; hint?: string } & ComponentProps<'input'>) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-describedby={hintId}
          className={isPassword ? 'pe-10' : undefined}
          {...props}
        />
        {isPassword ? (
          <Button
            variant="ghost"
            size="icon"
            className="absolute inset-e-0.5 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** A labelled select that submits with the form (Radix renders a hidden native select). */
export function SelectField({
  label,
  hint,
  name,
  defaultValue,
  disabled,
  options,
}: {
  label: string
  hint?: string
  name: string
  defaultValue: string
  disabled?: boolean
  options: readonly { value: string; label: string }[]
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={defaultValue} disabled={disabled}>
        <SelectTrigger id={id} aria-describedby={hintId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Inline error for a form or page section. Renders nothing when there is no message. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
