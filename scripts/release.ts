#!/usr/bin/env tsx
/**
 * Release script for the bot-arena monorepo.
 *
 * The whole product carries one "fixed" version: the root package.json and
 * the two apps (apps/api, apps/web) always have the same number. packages/*
 * are private workspace packages and stay at their own internal 0.0.0.
 *
 * Only tags shaped exactly "vMAJOR.MINOR.PATCH" count as releases. The first
 * time this script runs and finds none, it tags the current HEAD as
 * v<root package.json version> and stops (there is nothing to release yet,
 * that tag IS HEAD). Every commit after that tag is what gets versioned and
 * changelogged; everything before it is invisible to this tooling.
 *
 * What it does, in order:
 *   1. Refuses to run on a dirty working tree (unless --allow-dirty).
 *   2. Finds the oldest and newest vX.Y.Z tags reachable from HEAD,
 *      auto-creating one at HEAD first if none exists (see resolveTagRange).
 *   3. Asks git-cliff for the next semver version from the Conventional
 *      Commits made since the newest tag.
 *   4. Regenerates CHANGELOG.md, scoped to [oldest tag..HEAD], via git-cliff.
 *   5. Bumps "version" in the root, apps/api and apps/web package.json files
 *      (a targeted string replace, so formatting, key order and line endings
 *      are left untouched).
 *   6. Commits everything as `chore(release): vX.Y.Z` and tags it.
 *
 * Usage:
 *   pnpm release                  # bump, changelog, commit + tag
 *   pnpm release --dry-run        # show the plan, change nothing
 *   pnpm release --push           # also push the commit, the baseline tag and the new tag
 *   pnpm release --allow-dirty    # skip the clean-working-tree check
 *
 * See CONTRIBUTING.md for the commit convention this depends on.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const ROOT_PKG = path.join(ROOT, 'package.json')
/** Every package.json that carries the product version. */
const VERSIONED_PACKAGES = [
  ROOT_PKG,
  path.join(ROOT, 'apps/api/package.json'),
  path.join(ROOT, 'apps/web/package.json'),
]
// Relative on purpose: commands run with cwd = ROOT, and this avoids quoting paths with spaces.
const CHANGELOG_MD = 'CHANGELOG.md'

// Keep in sync with tag_pattern in cliff.toml: exactly vMAJOR.MINOR.PATCH, no suffix.
const SEMVER_TAG_RE = /^v(\d+)\.(\d+)\.(\d+)$/

const KNOWN_FLAGS = new Set(['--dry-run', '--push', '--allow-dirty'])
const args = process.argv.slice(2).filter((arg) => arg !== '--')
const unknownFlags = args.filter((arg) => !KNOWN_FLAGS.has(arg))
if (unknownFlags.length > 0) {
  console.error(`Unknown option(s): ${unknownFlags.join(', ')}`)
  console.error(`Supported: ${[...KNOWN_FLAGS].join(', ')}`)
  process.exit(1)
}
const DRY_RUN = args.includes('--dry-run')
const PUSH = args.includes('--push')
const ALLOW_DIRTY = args.includes('--allow-dirty')

type RunResult = { status: number; stdout: string; stderr: string }

function run(
  command: string,
  commandArgs: string[],
  options: { capture?: boolean } = {},
): RunResult {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    // pnpm is a .cmd shim on Windows and needs a shell; git is a real executable.
    shell: process.platform === 'win32' && command !== 'git',
  })
  if (result.error) throw result.error
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/** Runs git, returns trimmed stdout, throws with git's stderr on failure. */
function git(gitArgs: string[]): string {
  const result = run('git', gitArgs, { capture: true })
  if (result.status !== 0) {
    throw new Error(`git ${gitArgs.join(' ')} failed:\n${result.stderr.trim()}`)
  }
  return result.stdout.trim()
}

/** Runs git with output shown to the user (commit hooks, push progress). */
function gitVisible(gitArgs: string[]): void {
  const result = run('git', gitArgs)
  if (result.status !== 0) throw new Error(`git ${gitArgs.join(' ')} failed`)
}

/** git-cliff is a devDependency; `pnpm exec` finds it even when this file is run directly. */
function cliff(cliffArgs: string[], options: { capture?: boolean } = {}): RunResult {
  return run('pnpm', ['exec', 'git-cliff', ...cliffArgs], options)
}

async function main() {
  assertHasCommits()
  assertCleanTree()
  assertCliffAvailable()

  const { baselineTag, latestTag, bootstrapped } = resolveTagRange()

  if (bootstrapped) {
    console.log(`No "vMAJOR.MINOR.PATCH" tags found on this branch yet.`)
    console.log(
      `Treating this as the start of this workflow: history before HEAD is ignored from here on.`,
    )
    if (DRY_RUN) {
      console.log(`\n--dry-run: would create baseline tag ${baselineTag} at HEAD. Nothing written.`)
      return
    }
    git(['tag', baselineTag])
    console.log(`✓ Created baseline tag ${baselineTag} at HEAD.`)
    console.log(
      `Push it so clones and CI see the same starting point: git push origin ${baselineTag}`,
    )
    console.log(
      `Nothing to release yet: that tag IS the current commit. Make your next commit(s) with`,
    )
    console.log(`Conventional Commits, then run "pnpm release" again.`)
    return
  }

  const bumpRange = `${latestTag}..HEAD`
  const fullRange = `${baselineTag}..HEAD`

  const currentVersion = readVersion(ROOT_PKG)
  const bumpedResult = cliff([bumpRange, '--bumped-version'], { capture: true })
  const bumped = bumpedResult.status === 0 ? bumpedResult.stdout.trim() : ''
  const nextTag = bumped.startsWith('v') ? bumped : `v${bumped}`

  if (!bumped || nextTag === latestTag) {
    console.log(`No conventional commits since ${latestTag}: nothing to bump.`)
    return
  }

  const nextVersion = nextTag.replace(/^v/, '')
  console.log(`Current version: ${currentVersion}`)
  console.log(`Next version:    ${nextVersion}  (tag ${nextTag})`)

  if (DRY_RUN) {
    console.log(
      `\n--dry-run: previewing commits in ${bumpRange}. Nothing is written, committed or tagged.\n`,
    )
    const preview = cliff([bumpRange, '--tag', nextTag, '--unreleased'])
    if (preview.status !== 0) throw new Error('git-cliff preview failed')
    return
  }

  try {
    // Changelog first: it does not depend on package.json, and if it fails nothing has changed yet.
    const changelog = cliff([fullRange, '--tag', nextTag, '-o', CHANGELOG_MD])
    if (changelog.status !== 0) throw new Error('git-cliff failed to generate CHANGELOG.md')
    console.log('✓ Regenerated CHANGELOG.md')

    for (const file of VERSIONED_PACKAGES) bumpPackageVersion(file, nextVersion)
    console.log(`✓ Bumped ${VERSIONED_PACKAGES.length} package.json files`)

    git(['add', ...VERSIONED_PACKAGES.map((file) => path.relative(ROOT, file)), CHANGELOG_MD])
    gitVisible(['commit', '-m', `chore(release): ${nextTag}`])
    git(['tag', nextTag])
    console.log(`✓ Committed and tagged ${nextTag}`)
  } catch (error) {
    console.error(
      `\nRelease failed part-way. Files may be modified or staged but nothing is tagged.`,
    )
    console.error(
      `Fix the problem and commit by hand, or discard with: git checkout -- . && git reset`,
    )
    throw error
  }

  // The baseline tag must be on the remote too: clones resolve "oldest release" from it, and
  // without it the regenerated CHANGELOG.md would lose everything before the first pushed tag.
  if (PUSH) {
    // Explicit refs: a plain `git push` fails on a branch without an upstream (first push).
    gitVisible(['push', 'origin', 'HEAD', baselineTag, nextTag])
    console.log('✓ Pushed commit and tags')
  } else {
    console.log(`\nNot pushed. When ready:\n  git push origin HEAD ${baselineTag} ${nextTag}`)
  }
}

function assertHasCommits() {
  if (run('git', ['rev-parse', '--verify', 'HEAD'], { capture: true }).status !== 0) {
    console.error('This repository has no commits yet. Make a first commit before releasing.')
    process.exit(1)
  }
}

function assertCleanTree() {
  if (ALLOW_DIRTY) return
  if (git(['status', '--porcelain'])) {
    console.error(
      'Working tree is not clean. Commit or stash your changes first, or pass --allow-dirty.',
    )
    process.exit(1)
  }
}

function assertCliffAvailable() {
  if (cliff(['--version'], { capture: true }).status !== 0) {
    console.error('git-cliff is not available. Run "pnpm install" first (it is a devDependency).')
    process.exit(1)
  }
}

/**
 * Finds every tag reachable from HEAD that is EXACTLY "vMAJOR.MINOR.PATCH"
 * and returns the oldest (the baseline, where this workflow starts) and the
 * newest (the latest real release, where "unreleased" commits start).
 *
 * If none exist (first run ever), returns `v<root package.json version>` as
 * both with `bootstrapped: true`. The caller creates the tag, so a --dry-run
 * never mutates anything.
 *
 * Tags with any other shape do not match the pattern and are invisible here
 * and to git-cliff.
 */
function resolveTagRange(): { baselineTag: string; latestTag: string; bootstrapped: boolean } {
  const parsed = git(['tag', '--list', '--merged', 'HEAD'])
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => {
      const match = tag.match(SEMVER_TAG_RE)
      return match
        ? { tag, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
        : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const [oldest] = [...parsed].sort(byVersion)
  const [newest] = [...parsed].sort((a, b) => byVersion(b, a))

  if (!oldest || !newest) {
    const bootstrapTag = `v${readVersion(ROOT_PKG)}`
    return { baselineTag: bootstrapTag, latestTag: bootstrapTag, bootstrapped: true }
  }
  return { baselineTag: oldest.tag, latestTag: newest.tag, bootstrapped: false }
}

type ParsedTag = { major: number; minor: number; patch: number }
function byVersion(a: ParsedTag, b: ParsedTag): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

function readVersion(filePath: string): string {
  const { version } = JSON.parse(readFileSync(filePath, 'utf8')) as { version?: string }
  if (!version) throw new Error(`No "version" field in ${filePath}`)
  return version
}

/**
 * Replaces just the first "version" field's value, leaving every other byte of
 * the file (formatting, key order, line endings) untouched, so the diff is one line.
 */
function bumpPackageVersion(filePath: string, newVersion: string) {
  const raw = readFileSync(filePath, 'utf8')
  const versionFieldRe = /"version":\s*"[^"]*"/
  if (!versionFieldRe.test(raw)) {
    throw new Error(`Could not find a "version" field in ${filePath}`)
  }
  writeFileSync(filePath, raw.replace(versionFieldRe, `"version": "${newVersion}"`))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
