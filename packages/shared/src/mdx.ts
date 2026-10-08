/**
 * What question statements may contain (decision 32). The API enforces it when a statement is
 * saved or previewed; the web app maps the same names to React components when rendering.
 * Statements are authored by admins only, compiled on the server, and cannot import anything
 * or contain JavaScript expressions.
 */

/** Components usable in MDX, with the attributes each one accepts (string values only). */
export const MDX_COMPONENTS = {
  /** A highlighted aside. `title` is optional. */
  Note: ['title'],
  /** A warning aside. `title` is optional. */
  Warning: ['title'],
  /** An example input and output, shown side by side. */
  Sample: ['input', 'output'],
} as const satisfies Record<string, readonly string[]>

export type MdxComponentName = keyof typeof MDX_COMPONENTS

/** Plain HTML tags that may be written inline. They take no attributes. */
export const MDX_HTML_TAGS = [
  'b',
  'i',
  'u',
  'em',
  'strong',
  'sub',
  'sup',
  'kbd',
  'code',
  'br',
] as const

/** URL schemes allowed in links and images. Relative URLs and `#anchors` are allowed too. */
export const MDX_URL_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const
