import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/30',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
