'use client'

import { CircleAlert, Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

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
            className="absolute end-0.5 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
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

/** A label, a textarea and an optional hint, wired together for screen readers. */
export function TextareaField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & ComponentProps<'textarea'>) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} aria-describedby={hintId} {...props} />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** A checkbox with its label (and optional hint) as one click target. */
export function CheckboxField({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          aria-describedby={hintId}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {hint ? (
        <p id={hintId} className="ps-6 text-xs text-muted-foreground">
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
  onValueChange,
}: {
  label: string
  hint?: string
  name: string
  defaultValue: string
  disabled?: boolean
  options: readonly { value: string; label: string }[]
  onValueChange?: (value: string) => void
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={onValueChange}
      >
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
