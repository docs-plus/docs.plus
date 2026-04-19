#!/usr/bin/env bun
/**
 * Pre-publish guard for @docs.plus/extension-hyperlink.
 *
 * peerDependencies in package.json use the `catalog:` protocol, which is a
 * Bun / pnpm workspace feature. Only `bun publish` (and `pnpm publish`) resolve
 * `catalog:` to a concrete semver range at pack time. `npm publish` would
 * ship a literal "catalog:" string in the published package.json, breaking
 * every consumer install with `Invalid Version: catalog:`.
 *
 * This script runs from the `prepublishOnly` lifecycle hook (which Bun, npm,
 * yarn, and pnpm all honor) and fails fast if anything other than Bun is
 * driving the publish. It also asserts that the freshly built artifacts the
 * publish will ship actually exist.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

const fail = (msg: string): never => {
  console.error(`\n${RED}✗ preflight failed${RESET} — ${msg}\n`)
  process.exit(1)
}

const ok = (msg: string) => {
  console.error(`${GREEN}✓${RESET} ${msg}`)
}

// ---------------------------------------------------------------------------
// 1. Publisher check — must be Bun
// ---------------------------------------------------------------------------
const userAgent = process.env.npm_config_user_agent ?? ''
if (!userAgent.startsWith('bun/')) {
  fail(
    [
      `peerDependencies use the \`catalog:\` protocol, which only Bun resolves`,
      `at pack time. Detected publisher: ${YELLOW}${userAgent || '(unknown)'}${RESET}`,
      ``,
      `  Run:  ${GREEN}bun publish${RESET}`,
      `  Not:  ${RED}npm publish / yarn publish / pnpm publish${RESET}`,
      ``,
      `If you really need to publish from npm, substitute \`catalog:\` with the`,
      `concrete semver range from the root package.json's \`catalog\` field first.`
    ].join('\n  ')
  )
}
ok(`publisher is Bun (${userAgent.split(' ')[0]})`)

// ---------------------------------------------------------------------------
// 2. Build artifact check — files the `exports` map points at must exist
// ---------------------------------------------------------------------------
const distFiles = [
  'dist/index.js',
  'dist/index.cjs',
  'dist/index.d.ts',
  'dist/index.d.cts',
  'dist/styles.css'
]

for (const f of distFiles) {
  if (!existsSync(join(process.cwd(), f))) {
    fail(`missing build artifact: ${f}\n\n  Run \`bun run build\` first.`)
  }
}
ok(`all ${distFiles.length} dist artifacts present`)

// ---------------------------------------------------------------------------
// 3. Defense in depth — no literal `catalog:` survived into dist
// ---------------------------------------------------------------------------
// tsup bundles dependencies' versions into the dist; a `catalog:` leak here
// would mean a peerDep slipped past Bun's resolver. Cheap belt-and-suspenders.
for (const f of ['dist/index.js', 'dist/index.cjs']) {
  const content = readFileSync(join(process.cwd(), f), 'utf8')
  if (content.includes('"catalog:"') || content.includes("'catalog:'")) {
    fail(`literal "catalog:" string found in ${f} — bundle resolution failed`)
  }
}
ok('no `catalog:` leakage in built bundles')

console.error(`\n${GREEN}preflight passed${RESET} — safe to publish\n`)
