#!/usr/bin/env bun
/**
 * release-family.ts — coordinate a lockstep release of all publishable
 * `@docs.plus/extension-*` packages.
 *
 * See RELEASE_POLICY.md for the doctrine, phase rules, and the contract this
 * script implements. The script is the Phase 2 release path; running it
 * during Phase 1 cutover will fail the lockstep preflight (correctly), and
 * --dry-run mode can be used to verify that today.
 *
 * Usage:
 *   bun run release:family [--dry-run] [--tag next|latest] [--allow-noop]
 *   bun run release:family --generate-noop-changelogs
 *   bun run release:family --help
 */

import { existsSync, readFileSync, statSync, writeFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import process from 'node:process'

const REPO_ROOT = resolve(import.meta.dir, '..')

const PUBLISHABLE_PACKAGES = [
  'extension-hyperlink',
  'extension-hypermultimedia',
  'extension-indent',
  'extension-inline-code',
  'extension-placeholder'
] as const

type PackageDir = (typeof PUBLISHABLE_PACKAGES)[number]

interface CliArgs {
  dryRun: boolean
  tag: 'next' | 'latest'
  allowNoop: boolean
  generateNoopChangelogs: boolean
}

interface PackageInfo {
  shortName: PackageDir
  fullName: string
  version: string
  packagePath: string
}

interface PreflightResult {
  ok: boolean
  errors: string[]
}

const HELP = `bun run release:family — coordinate a lockstep family release.

Options:
  --dry-run                       Run all checks; print what would happen; never publish or tag
  --tag <next|latest>             npm dist-tag for the release (default: next)
  --allow-noop                    Confirm intentional no-op releases for unchanged packages
  --generate-noop-changelogs      Auto-generate boilerplate CHANGELOG entries for no-op packages, then exit
  --help                          Show this message

See RELEASE_POLICY.md for doctrine, phase rules, and the full contract.
`

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP)
    process.exit(0)
  }
  const dryRun = args.includes('--dry-run')
  const allowNoop = args.includes('--allow-noop')
  const generateNoopChangelogs = args.includes('--generate-noop-changelogs')
  let tag: 'next' | 'latest' = 'next'
  const tagIdx = args.indexOf('--tag')
  if (tagIdx >= 0) {
    const v = args[tagIdx + 1]
    if (v !== 'next' && v !== 'latest') {
      die(`--tag must be 'next' or 'latest' (got: ${String(v)})`)
    }
    tag = v
  }
  return { dryRun, tag, allowNoop, generateNoopChangelogs }
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function section(title: string) {
  process.stdout.write(`\n${title}\n${'─'.repeat(Math.min(title.length, 60))}\n`)
}
function ok(msg: string) {
  process.stdout.write(`  ✓ ${msg}\n`)
}
function info(msg: string) {
  process.stdout.write(`  · ${msg}\n`)
}
function warn(msg: string) {
  process.stdout.write(`  ! ${msg}\n`)
}
function die(msg: string): never {
  process.stderr.write(`\n✗ ${msg}\n\n`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Process helpers
//
// Use spawnSync (no shell) for all commands. This keeps secrets like the
// npm OTP off the shell command line and out of `ps aux` argv visibility.
// ---------------------------------------------------------------------------

interface RunResult {
  status: number
  stdout: string
  stderr: string
}

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; allowFail?: boolean } = {}
): RunResult {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const result: RunResult = {
    status: r.status ?? -1,
    stdout: (r.stdout ?? '').toString().trim(),
    stderr: (r.stderr ?? '').toString().trim()
  }
  if (result.status !== 0 && !opts.allowFail) {
    die(`${cmd} ${args.join(' ')} failed (exit ${result.status})\n${result.stderr}`)
  }
  return result
}

function runOk(cmd: string, args: string[], opts: { cwd?: string } = {}): string {
  return run(cmd, args, opts).stdout
}

function tryRun(cmd: string, args: string[], opts: { cwd?: string } = {}): string {
  return run(cmd, args, { ...opts, allowFail: true }).stdout
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ---------------------------------------------------------------------------
// Package discovery
// ---------------------------------------------------------------------------

function loadPackage(shortName: PackageDir): PackageInfo {
  const packagePath = join(REPO_ROOT, 'packages', shortName)
  const packageJsonPath = join(packagePath, 'package.json')
  if (!existsSync(packageJsonPath)) {
    die(`Package not found: ${packageJsonPath}`)
  }
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name?: string
    version?: string
  }
  if (!pkg.name || !pkg.version) {
    die(`${shortName}/package.json missing name or version`)
  }
  return { shortName, fullName: pkg.name, version: pkg.version, packagePath }
}

function loadAllPackages(): PackageInfo[] {
  return PUBLISHABLE_PACKAGES.map(loadPackage)
}

function npmVersionExists(fullName: string, version: string): boolean {
  const out = tryRun('npm', ['view', `${fullName}@${version}`, 'version'])
  return out === version
}

function npmAllVersions(fullName: string): string[] {
  const out = tryRun('npm', ['view', fullName, 'versions', '--json'])
  if (!out) return []
  try {
    const parsed: unknown = JSON.parse(out)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')
    if (typeof parsed === 'string') return [parsed]
    return []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Preflight checks (see RELEASE_POLICY.md "Preflight")
// ---------------------------------------------------------------------------

function checkLockstep(packages: PackageInfo[]): PreflightResult {
  const versions = new Set(packages.map((p) => p.version))
  if (versions.size === 1) {
    ok(`Lockstep: all ${packages.length} packages at ${[...versions][0]}`)
    return { ok: true, errors: [] }
  }
  return {
    ok: false,
    errors: [
      `Lockstep violated: not all publishable packages share a version.`,
      ...packages.map((p) => `      ${p.fullName}: ${p.version}`),
      `    Phase 1 cutover may still be in progress.`,
      `    See RELEASE_POLICY.md "Versioning Doctrine" and "Phase 1 — Cutover".`
    ]
  }
}

function checkChangelogEntries(packages: PackageInfo[], targetVersion: string): PreflightResult {
  const errors: string[] = []
  const escapedVersion = targetVersion.replace(/\./g, '\\.')
  const headerRe = new RegExp(`^## \\[${escapedVersion}\\]`, 'm')
  for (const pkg of packages) {
    const changelogPath = join(pkg.packagePath, 'CHANGELOG.md')
    if (!existsSync(changelogPath)) {
      errors.push(`${pkg.fullName}: CHANGELOG.md not found`)
      continue
    }
    const content = readFileSync(changelogPath, 'utf8')
    if (!headerRe.test(content)) {
      errors.push(`${pkg.fullName}: CHANGELOG.md missing "## [${targetVersion}]" entry`)
    } else {
      ok(`CHANGELOG entry present: ${pkg.fullName}`)
    }
  }
  if (errors.length > 0) {
    errors.push(
      `    For no-op packages (no src/ changes since previous release), run:`,
      `      bun run release:family --generate-noop-changelogs`
    )
  }
  return { ok: errors.length === 0, errors }
}

function newestMtime(dir: string): number {
  let newest = 0
  const stack: string[] = [dir]
  while (stack.length > 0) {
    const current = stack.pop()!
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile()) {
        try {
          const mtime = statSync(full).mtimeMs
          if (mtime > newest) newest = mtime
        } catch {
          // ignore
        }
      }
    }
  }
  return newest
}

function checkBuildArtifacts(packages: PackageInfo[]): PreflightResult {
  const errors: string[] = []
  for (const pkg of packages) {
    const distPath = join(pkg.packagePath, 'dist')
    const srcPath = join(pkg.packagePath, 'src')
    if (!existsSync(distPath)) {
      errors.push(`${pkg.fullName}: dist/ not found — run \`bun run build\` in the package`)
      continue
    }
    const distMtime = newestMtime(distPath)
    const srcMtime = newestMtime(srcPath)
    if (distMtime === 0) {
      errors.push(`${pkg.fullName}: dist/ is empty`)
    } else if (srcMtime > distMtime) {
      errors.push(`${pkg.fullName}: src/ newer than dist/ — rebuild needed`)
    } else {
      ok(`Build fresh: ${pkg.fullName}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

function checkPerPackagePreflight(packages: PackageInfo[]): PreflightResult {
  const errors: string[] = []
  for (const pkg of packages) {
    const preflightPath = join(pkg.packagePath, 'scripts', 'preflight.ts')
    if (!existsSync(preflightPath)) {
      errors.push(
        `${pkg.fullName}: scripts/preflight.ts not found — see RELEASE_POLICY.md "Per-package readiness checklist"`
      )
      continue
    }
    const r = run('bun', ['run', 'scripts/preflight.ts'], { cwd: pkg.packagePath, allowFail: true })
    if (r.status !== 0) {
      errors.push(`${pkg.fullName}: preflight failed\n${r.stderr || r.stdout}`)
    } else {
      ok(`Per-package preflight: ${pkg.fullName}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

function checkGitState(): PreflightResult {
  const errors: string[] = []
  const status = tryRun('git', ['status', '--porcelain'])
  if (status) {
    errors.push(`Working tree is not clean. Commit or stash changes first.\n${status}`)
  } else {
    ok('Working tree clean')
  }
  tryRun('git', ['fetch', 'origin', 'main'])
  const localHead = tryRun('git', ['rev-parse', 'HEAD'])
  const originHead = tryRun('git', ['rev-parse', 'origin/main'])
  if (localHead && originHead && localHead !== originHead) {
    errors.push(
      `HEAD (${localHead.slice(0, 8)}) does not match origin/main (${originHead.slice(0, 8)}). Pull or push first.`
    )
  } else if (localHead && localHead === originHead) {
    ok('HEAD matches origin/main')
  }
  return { ok: errors.length === 0, errors }
}

function checkIdentity(): PreflightResult {
  const errors: string[] = []
  const npmUser = tryRun('npm', ['whoami'])
  if (!npmUser) {
    errors.push('Not logged in to npm. Run `npm login` first.')
  } else {
    ok(`npm user: ${npmUser}`)
  }
  const gitEmail = tryRun('git', ['config', 'user.email'])
  if (!gitEmail) {
    errors.push('git user.email not configured.')
  } else {
    ok(`git user.email: ${gitEmail}`)
  }
  return { ok: errors.length === 0, errors }
}

function checkTagCollision(packages: PackageInfo[], targetVersion: string): PreflightResult {
  const errors: string[] = []
  const remoteTags = tryRun('git', ['ls-remote', '--tags', 'origin'])
  for (const pkg of packages) {
    const tag = `${pkg.fullName}@${targetVersion}`
    const localExists = tryRun('git', ['tag', '-l', tag])
    if (localExists) {
      errors.push(`Local tag already exists: ${tag}`)
      continue
    }
    if (remoteTags.includes(`refs/tags/${tag}`)) {
      errors.push(`Remote tag already exists: ${tag}`)
    } else {
      ok(`Tag available: ${tag}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

function findNoopPackages(packages: PackageInfo[], targetVersion: string): PackageInfo[] {
  const noops: PackageInfo[] = []
  for (const pkg of packages) {
    const versions = npmAllVersions(pkg.fullName).filter((v) => v !== targetVersion)
    if (versions.length === 0) continue
    const prevVersion = versions[versions.length - 1]
    const prevTag = `${pkg.fullName}@${prevVersion}`
    const tagExists = tryRun('git', ['tag', '-l', prevTag])
    if (!tagExists) continue
    const diff = tryRun('git', ['diff', `${prevTag}..HEAD`, '--', `packages/${pkg.shortName}/src/`])
    if (!diff) noops.push(pkg)
  }
  return noops
}

function checkNoopIntentionality(
  packages: PackageInfo[],
  targetVersion: string,
  allowNoop: boolean
): PreflightResult {
  const noops = findNoopPackages(packages, targetVersion)
  if (noops.length === 0) {
    ok('No no-op releases detected')
    return { ok: true, errors: [] }
  }
  if (allowNoop) {
    info(`No-op releases (--allow-noop): ${noops.map((p) => p.fullName).join(', ')}`)
    return { ok: true, errors: [] }
  }
  return {
    ok: false,
    errors: [
      `No-op releases detected (no src/ changes since previous published version):`,
      ...noops.map((p) => `      ${p.fullName}`),
      `    Re-run with --allow-noop to confirm an intentional no-op family release.`,
      `    See RELEASE_POLICY.md "No-op releases".`
    ]
  }
}

// ---------------------------------------------------------------------------
// No-op CHANGELOG generation (see RELEASE_POLICY.md Decision 3)
// ---------------------------------------------------------------------------

function generateNoopChangelogEntries(packages: PackageInfo[], targetVersion: string): void {
  section('Generating no-op CHANGELOG entries')
  const today = new Date().toISOString().slice(0, 10)
  const escapedVersion = targetVersion.replace(/\./g, '\\.')
  const headerRe = new RegExp(`^## \\[${escapedVersion}\\]`, 'm')
  const noops = findNoopPackages(packages, targetVersion)
  if (noops.length === 0) {
    info('No no-op packages detected (or all are missing prior tags / never published).')
    return
  }
  for (const pkg of noops) {
    const changelogPath = join(pkg.packagePath, 'CHANGELOG.md')
    if (!existsSync(changelogPath)) {
      warn(`${pkg.fullName}: CHANGELOG.md not found, skipping`)
      continue
    }
    const content = readFileSync(changelogPath, 'utf8')
    if (headerRe.test(content)) {
      info(`${pkg.fullName}: entry for ${targetVersion} already present, skipping`)
      continue
    }
    const versions = npmAllVersions(pkg.fullName).filter((v) => v !== targetVersion)
    const prevVersion = versions[versions.length - 1] ?? '0.0.0'
    const newEntry =
      `## [${targetVersion}] — ${today}\n\n` +
      `Aligned to docs.plus ${targetVersion} family release. ` +
      `No behavioral changes since ${prevVersion}.\n\n`
    const firstHeaderIdx = content.search(/^## \[/m)
    const updated =
      firstHeaderIdx === -1
        ? content.trimEnd() + '\n\n' + newEntry
        : content.slice(0, firstHeaderIdx) + newEntry + content.slice(firstHeaderIdx)
    writeFileSync(changelogPath, updated)
    ok(`Generated entry for ${pkg.fullName} (${prevVersion} → ${targetVersion})`)
  }
  info('Review the generated entries, commit them, then re-run release:family.')
}

// ---------------------------------------------------------------------------
// Publish loop and post-publish batch
// ---------------------------------------------------------------------------

interface PublishOutcome {
  published: PackageInfo[]
  skipped: PackageInfo[]
}

async function publishLoop(
  packages: PackageInfo[],
  targetVersion: string,
  tag: 'next' | 'latest',
  dryRun: boolean
): Promise<PublishOutcome> {
  const published: PackageInfo[] = []
  const skipped: PackageInfo[] = []
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i]
    section(`Step ${i + 1}/${packages.length}: ${pkg.fullName}@${targetVersion}`)
    if (npmVersionExists(pkg.fullName, targetVersion)) {
      info('Already on npm, skipping publish')
      ensureLocalTag(pkg, targetVersion, dryRun)
      skipped.push(pkg)
      continue
    }
    if (dryRun) {
      info('[dry-run] would prompt for OTP')
      info(`[dry-run] would run: bun publish --tag ${tag} --otp ******`)
      info(`[dry-run] would create local tag: ${pkg.fullName}@${targetVersion}`)
      published.push(pkg)
      continue
    }
    const otp = await prompt(`  Enter OTP for ${pkg.fullName}: `)
    if (!/^\d{6,8}$/.test(otp)) {
      die(`Invalid OTP format. Expected 6–8 digits.`)
    }
    process.stdout.write('  Publishing...\n')
    const r = run('bun', ['publish', '--tag', tag, '--otp', otp], {
      cwd: pkg.packagePath,
      allowFail: true
    })
    if (r.status !== 0) {
      process.stderr.write(r.stderr + '\n' + r.stdout + '\n')
      die(
        `bun publish failed for ${pkg.fullName}.\n` +
          `Resume with: bun run release:family\n` +
          `(Already-published packages stay published; the script will skip them on resume.)`
      )
    }
    ok('Published')
    ensureLocalTag(pkg, targetVersion, false)
    published.push(pkg)
  }
  return { published, skipped }
}

function ensureLocalTag(pkg: PackageInfo, targetVersion: string, dryRun: boolean): void {
  const tag = `${pkg.fullName}@${targetVersion}`
  const exists = tryRun('git', ['tag', '-l', tag])
  if (exists) {
    ok(`Tag already exists: ${tag}`)
    return
  }
  if (dryRun) {
    info(`[dry-run] would create tag: ${tag}`)
    return
  }
  runOk('git', ['tag', tag])
  ok(`Created tag: ${tag}`)
}

function pushTags(tags: string[], dryRun: boolean) {
  section('Pushing tags')
  if (tags.length === 0) {
    info('No tags to push')
    return
  }
  if (dryRun) {
    info(`[dry-run] would run: git push origin ${tags.join(' ')}`)
    return
  }
  runOk('git', ['push', 'origin', ...tags])
  for (const tag of tags) ok(`Pushed: ${tag}`)
}

function extractChangelogSlice(changelogPath: string, version: string): string {
  const content = readFileSync(changelogPath, 'utf8')
  const escapedVersion = version.replace(/\./g, '\\.')
  const startRe = new RegExp(`^## \\[${escapedVersion}\\][^\\n]*\\n`, 'm')
  const startMatch = startRe.exec(content)
  if (!startMatch) return ''
  const start = startMatch.index
  const headerLen = startMatch[0].length
  const after = content.slice(start + headerLen)
  const nextHeaderMatch = /^## \[/m.exec(after)
  return nextHeaderMatch ? after.slice(0, nextHeaderMatch.index).trim() : after.trim()
}

function ghReleaseExists(tagName: string): boolean {
  return run('gh', ['release', 'view', tagName], { allowFail: true }).status === 0
}

function createGithubReleases(
  packages: PackageInfo[],
  targetVersion: string,
  tag: 'next' | 'latest',
  dryRun: boolean
) {
  section('Creating GitHub releases')
  const isPrerelease = tag === 'next'
  for (const pkg of packages) {
    const tagName = `${pkg.fullName}@${targetVersion}`
    const changelogPath = join(pkg.packagePath, 'CHANGELOG.md')
    const notes = extractChangelogSlice(changelogPath, targetVersion)
    if (!notes) {
      warn(`Skipping GH release for ${pkg.fullName}: empty changelog slice`)
      continue
    }
    if (dryRun) {
      info(
        `[dry-run] would check: gh release view '${tagName}', then create if missing ${
          isPrerelease ? '(--prerelease)' : ''
        }`
      )
      continue
    }
    if (ghReleaseExists(tagName)) {
      ok(`Already exists: ${tagName}`)
      continue
    }
    const notesFile = join('/tmp', `release-notes-${pkg.shortName}-${targetVersion}.md`)
    writeFileSync(notesFile, notes)
    const ghArgs = ['release', 'create', tagName, '--title', tagName, '--notes-file', notesFile]
    if (isPrerelease) ghArgs.push('--prerelease')
    const r = run('gh', ghArgs, { allowFail: true })
    if (r.status !== 0) {
      warn(`Failed to create GH release for ${tagName}: ${r.stderr || r.stdout}`)
    } else {
      ok(`Created: ${tagName}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs()
  process.stdout.write(`bun run release:family${args.dryRun ? ' --dry-run' : ''}\n`)
  process.stdout.write(`tag: @${args.tag}${args.allowNoop ? '  --allow-noop' : ''}\n`)

  section('Discovering packages')
  const packages = loadAllPackages()
  for (const pkg of packages) info(`${pkg.fullName}: ${pkg.version}`)
  const targetVersion = packages[0].version

  if (args.generateNoopChangelogs) {
    if (new Set(packages.map((p) => p.version)).size !== 1) {
      die(
        `Cannot generate no-op CHANGELOG entries: lockstep is violated.\n` +
          `Align all package.json versions first, then re-run with --generate-noop-changelogs.`
      )
    }
    generateNoopChangelogEntries(packages, targetVersion)
    process.exit(0)
  }

  section('Preflight')
  const checks: Array<() => PreflightResult> = [
    () => checkLockstep(packages),
    () => checkChangelogEntries(packages, targetVersion),
    () => checkBuildArtifacts(packages),
    () => checkPerPackagePreflight(packages),
    () => checkGitState(),
    () => checkIdentity(),
    () => checkTagCollision(packages, targetVersion),
    () => checkNoopIntentionality(packages, targetVersion, args.allowNoop)
  ]
  const allErrors: string[] = []
  for (const check of checks) {
    const r = check()
    if (!r.ok) allErrors.push(...r.errors)
  }
  if (allErrors.length > 0) {
    process.stderr.write('\n✗ Preflight failed:\n')
    for (const e of allErrors) process.stderr.write(`    ${e}\n`)
    process.stderr.write(`\nNo OTP requested. Fix the issues above and re-run.\n\n`)
    process.exit(1)
  }
  ok('All preflight checks passed')

  if (!args.dryRun) {
    process.stdout.write(
      `\nReady to publish ${packages.length} packages at ${targetVersion} to @${args.tag}.\n`
    )
    const answer = await prompt('Proceed? [y/N]: ')
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      process.stdout.write('Aborted.\n')
      process.exit(0)
    }
  }

  const { published, skipped } = await publishLoop(packages, targetVersion, args.tag, args.dryRun)

  const releasedPackages = [...published, ...skipped]
  const tagsToPush = releasedPackages.map((pkg) => `${pkg.fullName}@${targetVersion}`)
  pushTags(tagsToPush, args.dryRun)
  createGithubReleases(releasedPackages, targetVersion, args.tag, args.dryRun)

  section('Summary')
  process.stdout.write(`  Target version: ${targetVersion}\n`)
  process.stdout.write(`  Tag: @${args.tag}\n`)
  process.stdout.write(`  Published: ${published.length}\n`)
  process.stdout.write(`  Skipped (already on npm): ${skipped.length}\n`)
  if (args.dryRun) {
    process.stdout.write(`\n  (--dry-run: no actual changes were made)\n`)
  } else {
    process.stdout.write('\n  npm:\n')
    for (const pkg of [...published, ...skipped]) {
      process.stdout.write(`    https://www.npmjs.com/package/${pkg.fullName}/v/${targetVersion}\n`)
    }
  }
  process.stdout.write('\n')
}

main().catch((err: unknown) => {
  process.stderr.write(`\n✗ Unhandled error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
