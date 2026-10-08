import type { MdxComponentName } from '@bot-arena/shared'
import { useTranslations } from 'next-intl'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const preClass =
  'min-h-8 overflow-x-auto rounded-md bg-muted p-2 font-mono text-sm whitespace-pre text-start'

/** An example input and output side by side. Also used for a question's sample tests. */
export function SampleBlock({
  input,
  output,
  title,
}: {
  input?: string
  output?: string
  title?: string
}) {
  const t = useTranslations('Mdx')
  return (
    <div className="my-3 rounded-lg border bg-card p-3">
      {title ? <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1">
          <p className="text-xs text-muted-foreground">{t('input')}</p>
          <pre dir="ltr" className={preClass}>
            {input ?? ''}
          </pre>
        </div>
        <div className="grid min-w-0 gap-1">
          <p className="text-xs text-muted-foreground">{t('output')}</p>
          <pre dir="ltr" className={preClass}>
            {output ?? ''}
          </pre>
        </div>
      </div>
    </div>
  )
}

function Aside({
  title,
  tone,
  children,
}: {
  title?: string
  tone: 'note' | 'warning'
  children?: ReactNode
}) {
  const t = useTranslations('Mdx')
  return (
    <aside
      className={cn(
        'my-3 rounded-md border-s-4 p-3',
        tone === 'note' ? 'border-primary bg-primary/10' : 'border-signal bg-signal/10',
      )}
    >
      <p className="mb-1 text-sm font-semibold">
        {title ?? (tone === 'note' ? t('note') : t('warning'))}
      </p>
      <div className="grid gap-2">{children}</div>
    </aside>
  )
}

const heading = (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', size: string) =>
  function Heading(props: ComponentPropsWithoutRef<'h1'>) {
    return <Tag {...props} className={cn('mt-5 mb-2', size)} />
  }

function Link({ href, ...props }: ComponentPropsWithoutRef<'a'>) {
  const external = typeof href === 'string' && /^https?:\/\//i.test(href)
  return (
    <a
      {...props}
      href={href}
      className="text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
    />
  )
}

function Code(props: ComponentPropsWithoutRef<'code'>) {
  return <code {...props} className={cn('font-mono text-[0.9em]', props.className)} />
}

function Pre(props: ComponentPropsWithoutRef<'pre'>) {
  return <pre dir="ltr" {...props} className={cn('my-3', preClass, 'p-3')} />
}

/**
 * Everything a statement can render. The server only lets allowlisted names through
 * (`MDX_COMPONENTS` in `@bot-arena/shared`), and the type below keeps this map in step with it.
 */
const custom: Record<MdxComponentName, unknown> = {
  Note: (props: { title?: string; children?: ReactNode }) => <Aside tone="note" {...props} />,
  Warning: (props: { title?: string; children?: ReactNode }) => <Aside tone="warning" {...props} />,
  Sample: SampleBlock,
}

export const mdxComponents = {
  ...custom,
  h1: heading('h1', 'text-2xl'),
  h2: heading('h2', 'text-xl'),
  h3: heading('h3', 'text-lg'),
  h4: heading('h4', 'text-base font-semibold'),
  h5: heading('h5', 'text-sm font-semibold'),
  h6: heading('h6', 'text-sm font-semibold'),
  p: (props: ComponentPropsWithoutRef<'p'>) => <p {...props} className="my-2" />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul {...props} className="my-2 list-disc ps-6" />,
  ol: (props: ComponentPropsWithoutRef<'ol'>) => (
    <ol {...props} className="my-2 list-decimal ps-6" />
  ),
  blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote {...props} className="my-3 border-s-4 ps-3 text-muted-foreground" />
  ),
  hr: () => <hr className="my-4 border-border" />,
  a: Link,
  code: Code,
  pre: Pre,
  img: (props: ComponentPropsWithoutRef<'img'>) => (
    // Statement images are admin-authored http(s) URLs, so a plain img is enough here.
    <img {...props} alt={props.alt ?? ''} className="my-3 max-w-full" />
  ),
  // Statement tables use the shadcn Table; cells may wrap, unlike in the app's data tables.
  table: (props: ComponentPropsWithoutRef<'table'>) => (
    <div className="my-3 rounded-lg border bg-card">
      <Table {...props} />
    </div>
  ),
  thead: (props: ComponentPropsWithoutRef<'thead'>) => <TableHeader {...props} />,
  tbody: (props: ComponentPropsWithoutRef<'tbody'>) => <TableBody {...props} />,
  tr: (props: ComponentPropsWithoutRef<'tr'>) => <TableRow {...props} />,
  th: (props: ComponentPropsWithoutRef<'th'>) => (
    <TableHead {...props} className="whitespace-normal" />
  ),
  td: (props: ComponentPropsWithoutRef<'td'>) => (
    <TableCell {...props} className="whitespace-normal" />
  ),
  kbd: (props: ComponentPropsWithoutRef<'kbd'>) => (
    <kbd {...props} className="rounded border bg-muted px-1 font-mono text-xs" />
  ),
}
