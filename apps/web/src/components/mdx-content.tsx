'use client'

import * as runtime from 'react/jsx-runtime'
import { Component, useMemo, type ComponentType, type ReactNode } from 'react'
import { mdxComponents } from './mdx-components'

type MdxBody = ComponentType<{ components?: Record<string, unknown> }>

/**
 * Turns the server's compiled statement into a React component. The compiled code is a function
 * body that only needs the JSX runtime: the API compiled it from admin-authored MDX that passed the
 * allowlist (no imports, no expressions, allowlisted components only), so it is plain element calls
 * with literal props.
 */
function load(compiled: string): MdxBody {
  const result = new Function(compiled)(runtime) as { default: MdxBody }
  return result.default
}

class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override render() {
    return this.state.failed ? (
      <p role="alert" className="text-sm text-destructive">
        This statement could not be displayed.
      </p>
    ) : (
      this.props.children
    )
  }
}

/** Renders a compiled MDX statement with the allowlisted components. */
export function MdxContent({ compiled }: { compiled: string }) {
  const body = useMemo<MdxBody | null>(() => {
    try {
      return load(compiled)
    } catch {
      return null
    }
  }, [compiled])

  if (!body) {
    return (
      <p role="alert" className="text-sm text-destructive">
        This statement could not be displayed.
      </p>
    )
  }
  const Body = body
  return (
    // Keyed by the code so a new statement resets a boundary that caught an error.
    <RenderBoundary key={compiled}>
      <div className="text-sm leading-6">
        <Body components={mdxComponents} />
      </div>
    </RenderBoundary>
  )
}
