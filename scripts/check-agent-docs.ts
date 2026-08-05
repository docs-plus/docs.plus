#!/usr/bin/env bun
/**
 * Integrity gate for the agent rule files. Run: bun scripts/check-agent-docs.ts
 * Exists because the 2026-08-03 AGENTS.md split moved 53 sections into per-directory files, and a
 * section reference or relative link that silently stops resolving makes a rule unreachable.
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')

/** Files whose headings a section reference may resolve against. */
const HEADING_SOURCES = [
  'AGENTS.md',
  'CLAUDE.md',
  'CONTEXT.md',
  'RELEASE_POLICY.md',
  'apps/webapp/CLAUDE.md',
  'apps/webapp/src/components/TipTap/CLAUDE.md',
  'apps/webapp/src/components/chatroom/CLAUDE.md',
  'apps/hocuspocus.server/CLAUDE.md',
  'apps/hocuspocus.server/API.md',
  'apps/admin-dashboard/CLAUDE.md',
  'packages/supabase/CLAUDE.md',
  'extensions/CLAUDE.md',
  'extensions/README.md',
  'extensions/extension-hyperlink/AGENTS.md',
  '.cursor/docs/design-system.md',
  '.cursor/docs/scripts-naming-convention.md',
  '.cursor/skills/release-extensions/SKILL.md'
]

const REFERRER_TYPES = /\.(md|mdc|ts|tsx|js|mjs|cjs|sh|sql|ya?ml)$/
const SECTION_REF = /§([A-Za-z][\w'-]*(?:\s+(?:\([^)]*\)|[A-Za-z][\w'-]*))*)/g
const MD_LINK = /\]\(([^)\s]+?)(?:#[^)\s]*)?\)/g
const BACKTICK = /`([^`\n]+)`/g
const PATH_EXT_WHITELIST = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'cts',
  'mts',
  'json',
  'md',
  'mdc',
  'scss',
  'css',
  'sql',
  'sh',
  'yml',
  'yaml',
  'html'
])
/** Phrasing this repo already uses to record that a path no longer exists or was never built. */
const NON_EXISTENCE_MARKER =
  /\b(deleted|removed|gone|migrated)\b|not implemented|out of scope|non-goals?/i

const read = (f: string) => readFileSync(resolve(ROOT, f), 'utf8')
const failures: string[] = []

const headings = new Set<string>()
for (const file of HEADING_SOURCES) {
  if (!existsSync(resolve(ROOT, file))) {
    failures.push(`heading source missing: ${file}`)
    continue
  }
  for (const line of read(file).split('\n')) {
    const m = /^#{1,4}\s+(.+?)\s*$/.exec(line)
    if (m) headings.add(m[1].replace(/[`*]/g, ''))
  }
}

/**
 * A reference resolves three ways: exactly, as a heading followed by trailing prose, or as an
 * abbreviation of a longer heading. Anything looser lets a renamed section keep passing — an earlier
 * word-by-word fallback hid 48% of heading deletions, against 9% here.
 */
const resolvesSection = (ref: string) => {
  const target = ref.replace(/'s\b/g, '').trim()
  for (const heading of headings) {
    if (target === heading) return true
    if (target.startsWith(heading) && ' ('.includes(target[heading.length])) return true
    if (heading.startsWith(target) && ' ('.includes(heading[target.length])) return true
  }
  return false
}

const trackedFiles = new Set(
  (await Bun.$`git -C ${ROOT} ls-files`.text()).split('\n').filter(Boolean)
)

/** An untracked rule file exists only on the laptop that wrote it — for everyone else the rule is gone. */
for (const file of HEADING_SOURCES) {
  if (existsSync(resolve(ROOT, file)) && !trackedFiles.has(file))
    failures.push(`${file} — not tracked by git; stage it or the rule ships to nobody`)
}

/** Working-tree deletions of tracked files (staged or not) are an ordinary workflow, not a gate failure. */
const files = [...trackedFiles].filter(
  (f) => REFERRER_TYPES.test(f) && existsSync(resolve(ROOT, f))
)

for (const file of files) {
  const body = read(file)
  if (!body.includes('§')) continue
  body.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(SECTION_REF)) {
      const ref = m[1].replace(/[.,;:—·]+$/, '').trim()
      if (!resolvesSection(ref)) failures.push(`${file}:${i + 1}  §${ref} — resolves to no heading`)
    }
  })
}

/** Rule/prose files whose relative links and prose paths must resolve. */
const LINK_SOURCES = [
  ...new Set([
    ...HEADING_SOURCES.filter((f) => f.endsWith('CLAUDE.md') || f.endsWith('SKILL.md')),
    'AGENTS.md',
    'RELEASE_POLICY.md',
    'CONTEXT.md',
    ...[...trackedFiles].filter((f) => /^\.cursor\/(docs|rules)\//.test(f))
  ])
].filter((f) => existsSync(resolve(ROOT, f)))

for (const file of LINK_SOURCES) {
  const here = dirname(file)
  read(file)
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(MD_LINK)) {
        const target = m[1]
        if (/^(https?:|mailto:|#)/.test(target)) continue
        if (target.startsWith('/'))
          failures.push(`${file}:${i + 1}  ${target} — root-absolute, use a relative path`)
        else if (!existsSync(resolve(ROOT, here, target)))
          failures.push(`${file}:${i + 1}  ${target} — broken link`)
      }
    })
}

/**
 * A backticked token that contains a `/` and ends in a known file extension reads as a repo path.
 * It resolves if it exists at its literal location, or as a tracked file's trailing path segment —
 * docs abbreviate by dropping leading directories (`utils/clientMessageId.ts`), never a middle one.
 */
const looksLikePath = (token: string) => {
  if (!/^[\w./-]+$/.test(token)) return false
  if (!token.includes('/')) return false
  if (token.startsWith('./') || token.startsWith('../')) return false
  if (token.split('/').some((seg) => seg === 'dist' || seg === 'node_modules')) return false
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(token)
  return !!ext && PATH_EXT_WHITELIST.has(ext[1].toLowerCase())
}

const pathResolves = (token: string) => {
  if (existsSync(resolve(ROOT, token))) return true
  const suffix = '/' + token
  for (const f of trackedFiles) if (f === token || f.endsWith(suffix)) return true
  return false
}

for (const file of LINK_SOURCES) {
  read(file)
    .split('\n')
    .forEach((line, i) => {
      // Scoped to the line, not the section: one "was removed" anywhere under a heading used to
      // exempt every path below it — 25% of all path tokens, hiding 9 broken ones.
      if (NON_EXISTENCE_MARKER.test(line)) return
      for (const m of line.matchAll(BACKTICK)) {
        const token = m[1].replace(/:\d+(-\d+)?$/, '')
        if (!looksLikePath(token)) continue
        if (pathResolves(token)) continue
        failures.push(`${file}:${i + 1}  \`${token}\` — path does not exist`)
      }
    })
}

/** Every per-directory CLAUDE.md must be reachable from the router, or a task's rules go unread. */
const routerLines = read('AGENTS.md').split('\n')
const routerStart = routerLines.findIndex((l) => l.trim() === '## Task router')

if (routerStart === -1) {
  failures.push('AGENTS.md — no "## Task router" section found')
} else {
  const routerEnd = routerLines.findIndex((l, i) => i > routerStart && /^##\s/.test(l))
  const routerText = routerLines
    .slice(routerStart, routerEnd === -1 ? routerLines.length : routerEnd)
    .join('\n')

  for (const file of [...trackedFiles].filter((f) => f.endsWith('/CLAUDE.md'))) {
    if (!routerText.includes(file))
      failures.push(`AGENTS.md Task router — ${file} is unreachable; add a router row for it`)
  }
}

if (failures.length) {
  console.error(`\n✖ agent-doc check: ${failures.length} problem(s)\n`)
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('\nSection homes are mapped in AGENTS.md §Filed by directory.\n')
  process.exit(1)
}

console.log(
  `✔ agent-doc check: ${headings.size} headings, ${files.length} files scanned, all references resolve`
)
