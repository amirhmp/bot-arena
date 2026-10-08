import { MDX_COMPONENTS, MDX_HTML_TAGS, MDX_URL_PROTOCOLS } from '@bot-arena/shared'
import type { MdxPreviewResult } from '@bot-arena/shared'
import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'

/** A statement that cannot be saved: bad MDX syntax, or something outside the allowlist. */
export class MdxCompileError extends Error {
  constructor(
    message: string,
    readonly line?: number,
    readonly column?: number,
  ) {
    super(message)
    this.name = 'MdxCompileError'
  }
}

// The few fields of the MDX syntax tree this check reads (avoids a dependency on mdast types).
type Attribute = { type: string; name?: string; value?: unknown }
type MdxNode = {
  type: string
  name?: string | null
  url?: string
  attributes?: Attribute[]
  children?: MdxNode[]
  position?: { start: { line: number; column: number } }
}

const COMPONENT_NAMES = Object.keys(MDX_COMPONENTS)
const HTML_TAGS: readonly string[] = MDX_HTML_TAGS
const PROTOCOLS: readonly string[] = MDX_URL_PROTOCOLS

function reject(node: MdxNode, message: string): never {
  throw new MdxCompileError(message, node.position?.start.line, node.position?.start.column)
}

function checkUrl(node: MdxNode, url: string): void {
  let protocol: string
  try {
    // The URL parser drops the tabs and newlines browsers ignore (`java\tscript:`), so this sees
    // the scheme a browser would. Relative URLs resolve against the placeholder and pass.
    protocol = new URL(url, 'https://statement.invalid').protocol
  } catch {
    return reject(node, `Invalid URL "${url}"`)
  }
  if (!PROTOCOLS.includes(protocol)) {
    reject(node, `Links and images may only use ${PROTOCOLS.join(', ')} URLs (got "${url}")`)
  }
}

function checkElement(node: MdxNode): void {
  const attributes = node.attributes ?? []
  if (node.name == null) {
    if (attributes.length > 0) reject(node, 'Fragments cannot have attributes')
    return
  }
  const allowedAttributes: readonly string[] | undefined = (
    MDX_COMPONENTS as Record<string, readonly string[]>
  )[node.name]
  if (!allowedAttributes && !HTML_TAGS.includes(node.name)) {
    reject(
      node,
      `<${node.name}> is not allowed. Components: ${COMPONENT_NAMES.join(', ')}. HTML tags: ${HTML_TAGS.join(', ')}.`,
    )
  }
  for (const attribute of attributes) {
    if (attribute.type !== 'mdxJsxAttribute' || !attribute.name) {
      reject(node, `<${node.name}> cannot use spread attributes or expressions`)
    }
    if (!allowedAttributes?.includes(attribute.name)) {
      reject(
        node,
        allowedAttributes && allowedAttributes.length > 0
          ? `<${node.name}> does not accept "${attribute.name}". Accepted: ${allowedAttributes.join(', ')}.`
          : `<${node.name}> does not accept attributes`,
      )
    }
    if (typeof attribute.value !== 'string') {
      reject(
        node,
        `Attribute "${attribute.name}" must be a quoted string, like ${attribute.name}="..."`,
      )
    }
  }
}

/**
 * Remark plugin that enforces the statement allowlist on the parsed tree (decision 32): no imports
 * or exports, no JavaScript expressions, only allowlisted components and attributes, and only safe
 * URL schemes. What passes compiles to plain element calls with literal props, nothing else.
 */
function remarkAllowlist() {
  return (tree: MdxNode) => {
    const stack: MdxNode[] = [tree]
    for (let node = stack.pop(); node; node = stack.pop()) {
      switch (node.type) {
        case 'mdxjsEsm':
          reject(node, 'import and export are not allowed in statements')
          break
        case 'mdxFlowExpression':
        case 'mdxTextExpression':
          reject(node, 'JavaScript expressions in { } are not allowed in statements')
          break
        case 'mdxJsxFlowElement':
        case 'mdxJsxTextElement':
          checkElement(node)
          break
        case 'link':
        case 'image':
        case 'definition':
          checkUrl(node, node.url ?? '')
          break
        case 'html':
        case 'yaml':
        case 'toml':
          reject(node, `${node.type} content is not allowed in statements`)
          break
      }
      if (node.children) stack.push(...node.children)
    }
  }
}

/**
 * Compiles an MDX statement to a function body that the web app evaluates with the React JSX
 * runtime (no module imports in the output). Throws `MdxCompileError` for anything invalid.
 */
export async function compileStatement(source: string): Promise<string> {
  try {
    const file = await compile(source, {
      outputFormat: 'function-body',
      development: false,
      remarkPlugins: [remarkGfm, remarkAllowlist],
    })
    return String(file)
  } catch (error) {
    if (error instanceof MdxCompileError) throw error
    const failure = error as { reason?: string; message?: string; line?: number; column?: number }
    throw new MdxCompileError(
      failure.reason ?? failure.message ?? 'Invalid MDX',
      failure.line ?? undefined,
      failure.column ?? undefined,
    )
  }
}

/** Same as `compileStatement`, but reports a bad statement as data (for the live preview). */
export async function previewStatement(source: string): Promise<MdxPreviewResult> {
  try {
    return { ok: true, compiled: await compileStatement(source) }
  } catch (error) {
    if (error instanceof MdxCompileError) {
      return {
        ok: false,
        error: { message: error.message, line: error.line, column: error.column },
      }
    }
    throw error
  }
}

/** A one-line description of a compile error for API error messages. */
export function describeCompileError(error: MdxCompileError): string {
  const where = error.line
    ? ` (line ${error.line}${error.column ? `, column ${error.column}` : ''})`
    : ''
  return `Statement: ${error.message}${where}`
}
