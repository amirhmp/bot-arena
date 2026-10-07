import { cn } from '@/lib/utils'

/** Two entries meet and one goes through: a tournament bracket reduced to its smallest form. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="square"
      aria-hidden
      className={cn('size-6 rtl:-scale-x-100', className)}
    >
      <path d="M3 6h6v12H3M9 12h9" />
      <circle cx="20" cy="12" r="2" className="fill-signal stroke-none" />
    </svg>
  )
}
