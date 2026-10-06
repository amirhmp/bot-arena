import { describe, expect, it } from 'vitest'
import { parseChangelog } from './changelog-parse'

describe('parseChangelog', () => {
  it('parses headings, paragraphs and lists from git-cliff output', () => {
    const blocks = parseChangelog(
      [
        '# Changelog',
        '',
        'All notable changes',
        'are documented here.',
        '',
        '## [Unreleased]',
        '',
        '### Features',
        '',
        '- **api:** Add status route',
        '- Add login page',
        '',
        '### Bug fixes',
        '- Fix typo',
      ].join('\n'),
    )
    expect(blocks).toEqual([
      { type: 'h1', text: 'Changelog' },
      { type: 'p', text: 'All notable changes are documented here.' },
      { type: 'h2', text: '[Unreleased]' },
      { type: 'h3', text: 'Features' },
      { type: 'list', items: ['**api:** Add status route', 'Add login page'] },
      { type: 'h3', text: 'Bug fixes' },
      { type: 'list', items: ['Fix typo'] },
    ])
  })

  it('never produces HTML: markup stays inside text', () => {
    const [block] = parseChangelog('- <script>alert(1)</script>')
    expect(block).toEqual({ type: 'list', items: ['<script>alert(1)</script>'] })
  })
})
