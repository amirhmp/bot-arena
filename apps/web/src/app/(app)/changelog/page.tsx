import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Fragment, type ReactNode } from 'react'
import { parseChangelog, type ChangelogBlock } from '@/lib/changelog-parse'
import { readChangelog } from '@/lib/changelog'

/** Renders **bold** and `code` spans; everything else is plain text. */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

function Block({ block }: { block: ChangelogBlock }) {
  switch (block.type) {
    case 'h1':
      return <h1 className="text-3xl">{inline(block.text)}</h1>
    case 'h2':
      return <h2 className="mt-10 border-b pb-2 text-xl">{inline(block.text)}</h2>
    case 'h3':
      return <h3 className="mt-5 text-sm text-muted-foreground">{inline(block.text)}</h3>
    case 'p':
      return <p className="mt-2 text-sm text-muted-foreground">{inline(block.text)}</p>
    case 'list':
      return (
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>
      )
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Changelog')
  return { title: t('metaTitle') }
}

export default async function ChangelogPage() {
  const t = await getTranslations('Changelog')
  const source = await readChangelog()
  if (source === null) {
    return (
      <article className="max-w-2xl">
        <h1 className="text-3xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('unavailable')}</p>
      </article>
    )
  }
  const blocks = parseChangelog(source)
  return (
    <article className="max-w-2xl">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </article>
  )
}
