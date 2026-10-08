import { describe, expect, it } from 'vitest'
import { compileStatement, MdxCompileError, previewStatement } from './mdx'

async function failure(source: string): Promise<MdxCompileError> {
  const error = await compileStatement(source).then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(MdxCompileError)
  return error as MdxCompileError
}

describe('MDX statement compilation', () => {
  it('compiles text, a code block and a sample to a function body with no imports', async () => {
    const source = [
      '# Sum of two numbers',
      '',
      'Read **two** integers and print their sum.',
      '',
      '```python',
      'print(sum(map(int, input().split())))',
      '```',
      '',
      '<Note title="Tip">Use 64-bit integers.</Note>',
      '',
      '<Sample input="3 4" output="7" />',
      '',
      '| a | b |',
      '| - | - |',
      '| 1 | 2 |',
    ].join('\n')
    const code = await compileStatement(source)
    expect(code).toContain('arguments[0]')
    expect(code).toContain('MDXContent')
    expect(code).not.toMatch(/^\s*import[\s{*]/m)
    expect(code).not.toMatch(/\bimport\(|\bawait\b/)
    expect(code).toContain('_jsx(Sample, {')
    // The compiled code can be run the way the web app runs it.
    const module = new Function(code)({ Fragment: Symbol('f'), jsx: () => null, jsxs: () => null })
    expect(typeof module.default).toBe('function')
  })

  it('reports bad syntax with a position', async () => {
    const error = await failure('Some text\n\n<Note>never closed')
    expect(error.line).toBe(3)
    expect(error.message.length).toBeGreaterThan(0)
  })

  it.each([
    ['imports', 'import x from "fs"\n\n# Hi'],
    ['exports', 'export const a = 1\n\n# Hi'],
    ['block expressions', '{process.env.SECRET}'],
    ['inline expressions', 'Hello {globalThis.alert(1)}'],
    ['attribute expressions', '<Sample input={"a"} output="b" />'],
    ['spread attributes', '<Sample {...props} />'],
    ['boolean attributes', '<Note title />'],
    ['unknown components', '<Danger>x</Danger>'],
    ['script tags', '<script>alert(1)</script>'],
    ['iframes', '<iframe src="https://example.com" />'],
    ['member components', '<a.b>x</a.b>'],
    ['unknown attributes', '<Sample input="1" output="2" onClick="x" />'],
    ['attributes on html tags', '<b style="color:red">x</b>'],
    ['event handlers on html tags', '<kbd onclick="x">x</kbd>'],
  ])('rejects %s', async (_name, source) => {
    await failure(source)
  })

  it.each([
    ['javascript links', '[x](javascript:alert(1))'],
    ['entity-encoded javascript links', '[x](&#106;avascript:alert(1))'],
    ['upper-case javascript links', '[x](JaVaScRiPt:alert(1))'],
    ['data images', '![x](data:image/svg+xml;base64,PHN2Zz4=)'],
    ['javascript definitions', '[x][a]\n\n[a]: javascript:alert(1)'],
    ['vbscript links', '[x](vbscript:msgbox(1))'],
  ])('rejects unsafe URLs: %s', async (_name, source) => {
    const error = await failure(source)
    expect(error.message).toMatch(/URL|link/i)
  })

  it('allows http, https, mailto and relative links', async () => {
    await compileStatement(
      '[a](https://example.com) [b](http://example.com/x) [c](mailto:a@b.c) [d](/rules) [e](#top)',
    )
  })

  it('allows the allowlisted components and html tags', async () => {
    await compileStatement(
      'Press <kbd>Ctrl</kbd> + <b>C</b>, x<sup>2</sup>.<br />\n\n<Warning>Careful</Warning>',
    )
  })

  it('turns a failure into data for the live preview', async () => {
    const ok = await previewStatement('# Fine')
    expect(ok).toMatchObject({ ok: true })
    const bad = await previewStatement('{1 + 1}')
    expect(bad).toMatchObject({ ok: false, error: { line: 1 } })
    expect(await previewStatement('')).toMatchObject({ ok: true })
  })
})
