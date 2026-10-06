export type ChangelogBlock =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }

/**
 * A small parser for the markdown git-cliff produces: headings, paragraphs and bullet lists.
 * Anything else is treated as a paragraph. Output is plain data, rendered as React elements,
 * so no HTML is ever injected.
 */
export function parseChangelog(markdown: string): ChangelogBlock[] {
  const blocks: ChangelogBlock[] = []
  let list: string[] | null = null
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'p', text: paragraph.join(' ') })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: 'list', items: list })
    list = null
  }

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^[-*]\s+(.*)$/.exec(line)

    if (heading?.[1] && heading[2] !== undefined) {
      flushParagraph()
      flushList()
      blocks.push({ type: `h${heading[1].length}` as 'h1' | 'h2' | 'h3', text: heading[2] })
    } else if (bullet?.[1] !== undefined) {
      flushParagraph()
      list ??= []
      list.push(bullet[1])
    } else if (line.trim() === '') {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  flushList()
  return blocks
}
