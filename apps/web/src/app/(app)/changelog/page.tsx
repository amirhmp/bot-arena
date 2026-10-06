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
        <code key={index} className="rounded bg-neutral-200 px-1 text-sm dark:bg-neutral-800">
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
      return <h1 className="text-2xl font-semibold">{inline(block.text)}</h1>
    case 'h2':
      return <h2 className="mt-8 text-xl font-semibold">{inline(block.text)}</h2>
    case 'h3':
      return (
        <h3 className="mt-4 text-sm font-semibold uppercase text-neutral-500">
          {inline(block.text)}
        </h3>
      )
    case 'p':
      return <p className="mt-2 text-sm text-neutral-500">{inline(block.text)}</p>
    case 'list':
      return (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>
      )
  }
}

export default async function ChangelogPage() {
  const blocks = parseChangelog(await readChangelog())
  return (
    <article className="max-w-2xl">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </article>
  )
}
