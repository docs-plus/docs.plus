#!/usr/bin/env bun
/**
 * Local replica of the prod quality gates. Husky pre-push runs this.
 * Stop the Next development server first — a production build corrupts a live .next.
 * Skipped gates are named so a green run never implies CI jobs this command did not execute.
 */

import { $ } from 'bun'
import { existsSync, lstatSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

import { PUBLISHABLE_EXTENSION_DIRS } from './publishable-extensions.ts'

const ROOT = resolve(import.meta.dir, '..')

// Keep in sync with `.github/filters/extensions.yaml` (`_shared` + per-package).
const SHARED_EXACT = new Set([
  'package.json',
  'bun.lock',
  'tsconfig.base.json',
  'tsup.base.ts',
  'scripts/publishable-extensions.ts',
  'scripts/build-extensions.sh',
  'scripts/run-tests.sh',
  'scripts/extension-preflight.sh'
])
const SHARED_PREFIXES = [
  'packages/floating-popover/',
  'packages/floating-tooltip/',
  'packages/playground/',
  'packages/release-tooling/',
  '.github/actions/build-extensions/',
  '.github/actions/setup-cypress/',
  '.github/actions/setup-bun/'
]

const SUPABASE_STUB = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key',
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

type Verdict = 'pass' | 'fail' | 'skip'
type Gate = { name: string; verdict: Verdict; note?: string }

const gates: Gate[] = []

function record(name: string, verdict: Verdict, note?: string): void {
  gates.push({ name, verdict, note })
  const pad = name.padEnd(28)
  const extra = note ? `  ${note}` : ''
  console.log(`${pad}${verdict}${extra}`)
}

async function gitLines(args: string[]): Promise<string[]> {
  const result = await $`git ${args}`.cwd(ROOT).quiet().nothrow()
  if (result.exitCode !== 0) return []
  return result.stdout
    .toString()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function changedPaths(): Promise<string[]> {
  const origin = await $`git rev-parse --verify origin/main`.cwd(ROOT).quiet().nothrow()
  if (origin.exitCode !== 0) return ['FORCE_ALL']
  const files = new Set<string>()
  for (const args of [
    ['diff', '--name-only', 'origin/main...HEAD'],
    ['diff', '--name-only'],
    ['diff', '--name-only', '--cached'],
    ['ls-files', '--others', '--exclude-standard']
  ]) {
    for (const file of await gitLines(args)) files.add(file)
  }
  return [...files]
}

function hitsShared(file: string): boolean {
  if (SHARED_EXACT.has(file)) return true
  return SHARED_PREFIXES.some((prefix) => file.startsWith(prefix))
}

function extensionsFor(changed: string[]): string[] {
  if (changed.includes('FORCE_ALL') || changed.some(hitsShared)) {
    return [...PUBLISHABLE_EXTENSION_DIRS]
  }
  return PUBLISHABLE_EXTENSION_DIRS.filter((dir) =>
    changed.some((file) => file === `extensions/${dir}` || file.startsWith(`extensions/${dir}/`))
  )
}

async function nextDevLive(): Promise<string | null> {
  const result = await $`ps -ax -o command=`.quiet().nothrow()
  const text = result.stdout.toString()
  if (/\bnext\s+(dev|start)\b/.test(text))
    return 'Next dest is live; a production build would corrupt that .next'
  return null
}

async function run(
  cmd: string[],
  opts?: { cwd?: string; env?: Record<string, string> }
): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd: opts?.cwd ?? ROOT,
    env: { ...process.env, ...opts?.env },
    stdout: 'inherit',
    stderr: 'inherit'
  })
  return proc.exited
}

async function runGate(
  name: string,
  cmd: string[],
  opts?: { cwd?: string; env?: Record<string, string> }
): Promise<boolean> {
  console.log(`\n── ${name}`)
  const code = await run(cmd, opts)
  record(name, code === 0 ? 'pass' : 'fail')
  return code === 0
}

const subject = (await gitLines(['log', '-1', '--format=%s']))[0] ?? ''
const appDeploy = /^\(build\):\s/.test(subject) && /\b(back|front)\b/.test(subject)
const changed = await changedPaths()
const extMatrix = extensionsFor(changed)
const destBlock = await nextDevLive()

console.log('check:ci — local replica of the prod quality gates')
console.log(`HEAD  ${subject || '(no commits)'}`)
console.log(
  `ext   ${extMatrix.length === 0 ? 'none (CI will skip the matrix)' : extMatrix.join(', ')}`
)
if (appDeploy) {
  console.log('note  this commit is a (build): deploy; CI will also run backend E2E')
}
console.log('')

let failed = false

if (!(await runGate('lint', ['bun', 'run', 'lint']))) failed = true
if (!(await runGate('lint:styles', ['bun', 'run', 'lint:styles']))) failed = true

console.log('\n── format (tracked files, project .prettierignore)')
const listed = await $`git ls-files -z`.cwd(ROOT).nothrow()
if (listed.exitCode !== 0) {
  record('format', 'fail', 'git ls-files failed')
  failed = true
} else {
  const files = listed.stdout
    .toString()
    .split('\0')
    .filter((file) => {
      if (!file) return false
      try {
        return !lstatSync(resolve(ROOT, file)).isSymbolicLink()
      } catch {
        return false
      }
    })
    .join('\0')
  const prettier = resolve(ROOT, 'node_modules/.bin/prettier')
  const pretty = Bun.spawn(
    [
      'xargs',
      '-0',
      prettier,
      '--check',
      '--ignore-unknown',
      '--ignore-path',
      resolve(ROOT, '.prettierignore'),
      '--'
    ],
    {
      cwd: ROOT,
      stdin: new Blob([`${files}\0`]),
      stdout: 'inherit',
      stderr: 'inherit'
    }
  )
  const code = await pretty.exited
  record(
    'format',
    code === 0 ? 'pass' : 'fail',
    'tracked files + project .prettierignore — untracked REPORT/PROPOSAL files are not in a CI checkout'
  )
  if (code !== 0) failed = true
}

console.log('\n── security (bun audit, fails on high)')
const auditJson = resolve(tmpdir(), `docsplus-audit-${process.pid}.json`)
try {
  const auditCapture = Bun.spawn(['bun', 'audit', '--json'], {
    cwd: ROOT,
    stdout: Bun.file(auditJson),
    stderr: 'ignore'
  })
  await auditCapture.exited
  const auditCode = await run([
    'bun',
    '.github/scripts/audit-gate.ts',
    auditJson,
    '.github/audit-allowlist.json'
  ])
  record('security', auditCode === 0 ? 'pass' : 'fail', 'fails on high')
  if (auditCode !== 0) failed = true
} finally {
  try {
    unlinkSync(auditJson)
  } catch {
  }
}

const distMissing = PUBLISHABLE_EXTENSION_DIRS.filter(
  (dir) => !existsSync(resolve(ROOT, 'extensions', dir, 'dist/index.js'))
)
if (distMissing.length > 0) {
  if (!(await runGate('extension dist', ['bash', 'scripts/build-extensions.sh']))) failed = true
}

if (!(await runGate('typecheck', ['bun', 'run', 'typecheck']))) failed = true

if (
  !(await runGate('webapp Jest', ['bun', 'run', '--filter', '@docs.plus/webapp', 'test'], {
    env: SUPABASE_STUB
  }))
) {
  failed = true
}

if (
  !(await runGate('backend tests', ['bun', 'run', 'test'], {
    cwd: resolve(ROOT, 'apps/hocuspocus.server')
  }))
) {
  failed = true
}

if (failed) {
  record('extension Cypress', 'skip', 'quality or unit gates failed')
  record('extension preflight', 'skip', 'quality or unit gates failed')
} else if (extMatrix.length === 0) {
  record('extension Cypress', 'skip', 'no extension-filter hit vs origin/main + working tree')
  record('extension preflight', 'skip', 'no extension-filter hit')
} else {
  const distReady = PUBLISHABLE_EXTENSION_DIRS.every((dir) =>
    existsSync(resolve(ROOT, 'extensions', dir, 'dist/index.js'))
  )
  if (
    !(await runGate(
      `extension Cypress (${extMatrix.join(' ')})`,
      ['bash', 'scripts/run-tests.sh', '--extensions'],
      {
        env: {
          EXT_ONLY: extMatrix.join(' '),
          EXTENSION_DIST_READY: distReady ? '1' : '0'
        }
      }
    ))
  ) {
    failed = true
  }
  if (
    !(await runGate('extension preflight', ['bash', 'scripts/extension-preflight.sh'], {
      env: { EXT_ONLY: extMatrix.join(' ') }
    }))
  ) {
    failed = true
  }
}

if (destBlock) {
  record('webapp build:ci', 'skip', destBlock)
} else if (failed) {
  record('webapp build:ci', 'skip', 'earlier gate failed')
} else if (
  !(await runGate('webapp build:ci', ['bun', 'run', '--filter', '@docs.plus/webapp', 'build:ci'], {
    env: SUPABASE_STUB
  }))
) {
  failed = true
}

if (failed) {
  record('admin build:ci', 'skip', 'earlier gate failed')
} else if (
  !(await runGate(
    'admin build:ci',
    ['bun', 'run', '--filter', '@docs.plus/admin-dashboard', 'build:ci'],
    { env: SUPABASE_STUB }
  ))
) {
  failed = true
}

record(
  'backend E2E',
  'skip',
  appDeploy
    ? 'CI will run this on (build): deploy — needs the workflow Postgres/Redis services'
    : 'CI skips this unless the commit is a (build): back or front deploy'
)
record('webapp Cypress', 'skip', 'not a prod quality-gate job')

console.log('')
console.log('── verdict')
for (const gate of gates) {
  const pad = gate.name.padEnd(28)
  const extra = gate.note ? `  ${gate.note}` : ''
  console.log(`${pad}${gate.verdict}${extra}`)
}
console.log('')
if (failed) {
  console.log('FAIL  one or more run gates failed. Do not push.')
  process.exit(1)
}
console.log('PASS  every run gate passed. Named skips are not implied green on GitHub.')
process.exit(0)
