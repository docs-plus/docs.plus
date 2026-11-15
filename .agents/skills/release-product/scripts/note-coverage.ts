// Lists every user-facing changelog entry of a release that the release note does not mention.
// An entry counts as covered when one of its docs.plus issue numbers or commit hashes is in the
// note, compared as whole tokens. An issue that several entries cite proves only one of them, so
// such entries print under "shared issue". An entry with no reference counts as covered when its
// bold lead phrase is in the note, and otherwise prints under "check by hand". Usage:
//   bun note-coverage.ts <X.Y.Z> [note] [changelog...]
// Defaults: Notes/release-X.Y.Z/RELEASE-NOTES.md and every tracked CHANGELOG.md, because app
// changes (link fixes on 2.3.6) often sit only in an app changelog. Before the bump, a non-empty
// `## [Unreleased]` stands in for `## [X.Y.Z]`. The first list names the section read per file.
// Scope is the GitHub milestone vX.Y.Z (maintainer ruling, 2026-11-15). Entries whose issues all
// sit in another milestone print apart and stay out of the note, and so does any such issue the
// note cites. Needs `gh`; without it the milestone check prints as skipped.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [version, notePath, ...changelogArgs] = process.argv.slice(2)
if (!version) throw new Error('usage: bun note-coverage.ts <X.Y.Z> [note] [changelog...]')

const note = readFileSync(notePath ?? `Notes/release-${version}/RELEASE-NOTES.md`, 'utf8')
const changelogPaths = changelogArgs.length
  ? changelogArgs
  : execSync("git ls-files '*CHANGELOG.md'", { encoding: 'utf8' }).split('\n').filter(Boolean)

// The newest version heading that is not the one being released, such as "2.3.0".
const lastVersion = (text: string): string | null =>
  [...text.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]).find((v) => v !== version) ??
  null
const sectionAt = (text: string, heading: string): string | null => {
  const start = text.indexOf(heading)
  if (start < 0) return null
  const next = text.indexOf('\n## [', start + 1)
  return text.slice(start, next < 0 ? undefined : next)
}
const hasEntries = (section: string): boolean => /^\s*- /m.test(section)

// Every changelog prints which section it used, so one that drops out is never silent.
const previous = lastVersion(readFileSync('CHANGELOG.md', 'utf8'))
type Source = { path: string; entry: string; stale: boolean }
const sections: Source[] = []
const readLog: string[] = []
for (const path of changelogPaths) {
  const text = readFileSync(path, 'utf8')
  const last = lastVersion(text)
  const released = sectionAt(text, `## [${version}]`)
  const unreleased = sectionAt(text, '## [Unreleased]')
  if (released) {
    sections.push({ path, entry: released, stale: false })
    readLog.push(`${path}: [${version}]`)
  } else if (unreleased && hasEntries(unreleased)) {
    // floating-popover and floating-tooltip keep every change since [2.0.0] here (RELEASE_POLICY.md).
    const stale = last !== null && previous !== null && last !== previous
    sections.push({ path, entry: unreleased, stale })
    readLog.push(
      `${path}: [Unreleased], last version [${last ?? 'none'}]${stale ? ', older than the last release' : ''}`
    )
  } else {
    readLog.push(
      `skipped: ${path} has no [${version}] or Unreleased entries, newest heading [${last ?? 'none'}]`
    )
  }
}
if (!sections.length) throw new Error(`no "## [${version}]" or non-empty "## [Unreleased]" found`)

// Sections a reader of the note cares about. Breaking and Migration go to the self-host part.
const USER_FACING = new Set(['Added', 'Changed', 'Fixed', 'Security', 'Removed'])

const flat = (text: string): string => text.toLowerCase().replace(/[*`]/g, '').replace(/\s+/g, ' ')
const noteFlat = flat(note)
// "**Folded sections open again.**" → "folded sections open again"
const leadIn = (block: string): string | null => {
  const bold = block.match(/^- \*\*(.+?)\*\*/s)
  return bold
    ? flat(bold[1])
        .replace(/[.,:;]+$/, '')
        .trim()
    : null
}

// Whole-token references only: `#64` must never match `#646`, and `tiptap#8584` is another repo.
const issueRefs = (text: string): Set<string> =>
  new Set(
    [...text.matchAll(/(?<![\w/])#(\d{1,6})\b|docs-plus\/docs\.plus\/issues\/(\d{1,6})\b/g)].map(
      (m) => m[1] ?? m[2]
    )
  )
const commitRefs = (text: string): string[] => [
  ...new Set([...text.matchAll(/\/commit\/([0-9a-f]{7,40})\b/g)].map((m) => m[1]))
]
const noteIssues = issueRefs(note)

// Issue number → milestone title, for the whole repo in one call.
let milestoneOf: Map<string, string> | null = null
try {
  const rows: { number: number; milestone: { title: string } | null }[] = JSON.parse(
    execSync('gh issue list --state all --limit 2000 --json number,milestone', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
  )
  milestoneOf = new Map(rows.map((r) => [String(r.number), r.milestone?.title ?? 'none']))
} catch {
  milestoneOf = null
}
const target = `v${version}`
// True when the entry cites issues and none of them is in this milestone.
const otherMilestone = (issues: string[]): string | null => {
  if (!milestoneOf || !issues.length) return null
  const titles = issues.map((n) => milestoneOf?.get(n) ?? 'none')
  if (titles.includes(target)) return null
  const named = [...new Set(titles.filter((t) => t !== 'none'))]
  return named.length ? named.join(', ') : null
}
const noteCommits = commitRefs(note)
// Short and full hashes name one commit, so compare by prefix in both directions.
const sameCommit = (a: string, b: string): boolean => a.startsWith(b) || b.startsWith(a)

// Sub-bullets are entries too, so one covered child never hides its siblings.
type Entry = { section: string; block: string; issues: string[]; commits: string[]; stale: boolean }
const entries: Entry[] = []
for (const { path, entry, stale } of sections) {
  let section = ''
  for (const raw of entry.split(/\n(?=\s*(?:### |- ))/)) {
    const block = raw.trimStart()
    const heading = block.match(/^### (\w+)/)
    if (heading) {
      section = heading[1]
      continue
    }
    if (!block.startsWith('- ') || !USER_FACING.has(section)) continue
    const label = path === 'CHANGELOG.md' ? section : `${path} ${section}`
    entries.push({
      section: label,
      block,
      issues: [...issueRefs(block)],
      commits: commitRefs(block),
      stale
    })
  }
}

const citations = new Map<string, number>()
for (const { issues } of entries)
  for (const n of issues) citations.set(n, (citations.get(n) ?? 0) + 1)

const missing: string[] = []
const shared: string[] = []
const manual: string[] = []
const older: string[] = []
const outOfScope: string[] = []
for (const { section, block, issues, commits, stale } of entries) {
  const summary = block.slice(2).replace(/\s+/g, ' ').slice(0, 110)
  const elsewhere = otherMilestone(issues)
  if (elsewhere) {
    outOfScope.push(
      `${section} [${issues.map((n) => `#${n}`).join(' ')}] (${elsewhere}): ${summary}`
    )
    continue
  }
  if (!issues.length && !commits.length) {
    const lead = leadIn(block)
    if (!(lead && noteFlat.includes(lead))) (stale ? older : manual).push(`${section}: ${summary}`)
    continue
  }
  const label = `${section} [${issues.map((n) => `#${n}`).join(' ')}]: ${summary}`
  const byCommit = commits.some((h) => noteCommits.some((c) => sameCommit(h, c)))
  const byIssue = issues.filter((n) => noteIssues.has(n))
  if (byCommit || byIssue.some((n) => citations.get(n) === 1)) continue
  if (stale) older.push(label)
  else if (byIssue.length) shared.push(label)
  else missing.push(label)
}

console.log('Changelogs read:')
for (const line of readLog) console.log(`  - ${line}`)
console.log(`\nNot in the note (${missing.length}):`)
for (const line of missing) console.log(`  - ${line}`)
console.log(`\nShared issue: the note cites it, but check this entry by hand (${shared.length}):`)
for (const line of shared) console.log(`  - ${line}`)
console.log(`\nNo reference, check by hand (${manual.length}):`)
for (const line of manual) console.log(`  - ${line}`)
console.log(
  `\nUnreleased since an older version, may have shipped already (${older.length}).` +
    ` Check each with: git merge-base --is-ancestor <sha> v${previous ?? '<previous>'}`
)
for (const line of older) console.log(`  - ${line}`)
if (!milestoneOf) console.log('\nMilestone check skipped: `gh issue list` failed.')
else {
  console.log(`\nOther milestone, keep out of the note (${outOfScope.length}):`)
  for (const line of outOfScope) console.log(`  - ${line}`)
  const strays = [...noteIssues].filter((n) => {
    const m = milestoneOf?.get(n)
    return m !== undefined && m !== target
  })
  console.log(`\nThe note cites issues outside ${target} — remove them (${strays.length}):`)
  for (const n of strays) console.log(`  - #${n} (${milestoneOf.get(n)})`)
  const unnamed = [...milestoneOf].filter(([n, m]) => m === target && !noteIssues.has(n))
  console.log(
    `\n${target} issues the note does not cite — cover each or give a reason (${unnamed.length}):`
  )
  for (const [n] of unnamed) console.log(`  - #${n}`)
}
console.log(
  '\nFor each line, write "note line N" or a reason it stays changelog-only (internal, CI, admin-only).'
)
