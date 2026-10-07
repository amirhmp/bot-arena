import type { ReactNode } from 'react'

/** Title, one-line explanation and an optional action, shared by every page. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid gap-1.5">
        <h1 className="text-3xl">{title}</h1>
        {description ? <p className="max-w-prose text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
