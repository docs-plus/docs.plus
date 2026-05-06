#!/usr/bin/env bun
/**
 * Shared `prepublishOnly` guard for docs.plus publishable libraries.
 *
 * peerDependencies use the `catalog:` protocol — a Bun / pnpm workspace
 * feature. Only `bun publish` (and `pnpm publish`) resolve `catalog:` to
 * a concrete semver range at pack time. `npm publish` would ship the
 * literal string and break every consumer install with
 * `Invalid Version: catalog:`.
 *
 * Asserts:
 *   1. publisher user-agent is `bun/*`
 *   2. every relative `dist/...` path referenced by the consuming
 *      package's `exports` map exists on disk
 *   3. no literal `catalog:` string survived into the JS bundles
 *      (defense in depth — would mean a peer-dep slipped past Bun's
 *      resolver)
 *
 * Fully data-driven: package name and dist artifact list come from the
 * consuming package's own `package.json` (`process.cwd()`/package.json).
 * No per-consumer parameterization needed.
 *
 * Consumed via:
 *   "prepublishOnly": "release-preflight"
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

const pkgPath = join(process.cwd(), 'package.json')
if (!existsSync(pkgPath)) {
  fail(`no package.json at ${process.cwd()}`)
}

type ExportsMap = string | { [key: string]: ExportsMap } | undefined
const pkg: { name?: string; exports?: ExportsMap } = JSON.parse(readFileSync(pkgPath, 'utf8'))
const pkgName = pkg.name ?? '(unknown)'

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
ok(`publisher is Bun (${userAgent.split(' ')[0]}) — ${pkgName}`)

function collectDistPaths(node: ExportsMap, acc: Set<string>): void {
  if (typeof node === 'string') {
    if (node.startsWith('./dist/')) acc.add(node.slice(2))
    return
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectDistPaths(v, acc)
  }
}

const distPaths = new Set<string>()
collectDistPaths(pkg.exports, distPaths)

if (distPaths.size === 0) {
  fail(`no dist/ paths found in package.json exports map`)
}

for (const f of distPaths) {
  if (!existsSync(join(process.cwd(), f))) {
    fail(`missing build artifact: ${f}\n\n  Run \`bun run build\` first.`)
  }
}
ok(`all ${distPaths.size} dist artifacts present`)

const jsBundles = [...distPaths].filter((f) => f.endsWith('.js') || f.endsWith('.cjs'))
for (const f of jsBundles) {
  const content = readFileSync(join(process.cwd(), f), 'utf8')
  if (content.includes('"catalog:"') || content.includes("'catalog:'")) {
    fail(`literal "catalog:" string found in ${f} — bundle resolution failed`)
  }
}
ok('no `catalog:` leakage in built bundles')

console.error(`\n${GREEN}preflight passed${RESET} — ${pkgName} safe to publish\n`)
