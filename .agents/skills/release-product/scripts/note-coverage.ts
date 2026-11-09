// Lists every user-facing changelog entry of a release that the release note does not mention.
// An entry counts as covered when one of its docs.plus issue numbers or commit hashes is in the
// note, compared as whole tokens. An issue that several entries cite proves only one of them, so
// such entries print under "shared issue". An entry with no reference counts as covered when its
// bold lead phrase is in the note, and otherwise prints under "check by hand". Usage:
//   bun note-coverage.ts <X.Y.Z> [note] [changelog]
// Defaults: Notes/release-X.Y.Z/RELEASE-NOTES.md and CHANGELOG.md, from the repo root.
import { readFileSync } from 'node:fs'

const [version, notePath, changelogPath = 'CHANGELOG.md'] = process.argv.slice(2)
if (!version) throw new Error('usage: bun note-coverage.ts <X.Y.Z> [note] [changelog]')

const note = readFileSync(notePath ?? `Notes/release-${version}/RELEASE-NOTES.md`, 'utf8')
const changelog = readFileSync(changelogPath, 'utf8')

const start = changelog.indexOf(`## [${version}]`)
if (start < 0) throw new Error(`no "## [${version}]" heading in ${changelogPath}`)
const next = changelog.indexOf('\n## [', start + 1)
const entry = changelog.slice(start, next < 0 ? undefined : next)

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
const noteCommits = commitRefs(note)
// Short and full hashes name one commit, so compare by prefix in both directions.
const sameCommit = (a: string, b: string): boolean => a.startsWith(b) || b.startsWith(a)

// Sub-bullets are entries too, so one covered child never hides its siblings.
type Entry = { section: string; block: string; issues: string[]; commits: string[] }
const entries: Entry[] = []
let section = ''
for (const raw of entry.split(/\n(?=\s*(?:### |- ))/)) {
  const block = raw.trimStart()
  const heading = block.match(/^### (\w+)/)
  if (heading) {
    section = heading[1]
    continue
  }
  if (!block.startsWith('- ') || !USER_FACING.has(section)) continue
  entries.push({ section, block, issues: [...issueRefs(block)], commits: commitRefs(block) })
}

const citations = new Map<string, number>()
for (const { issues } of entries)
  for (const n of issues) citations.set(n, (citations.get(n) ?? 0) + 1)

const missing: string[] = []
const shared: string[] = []
const manual: string[] = []
for (const { section, block, issues, commits } of entries) {
  const summary = block.slice(2).replace(/\s+/g, ' ').slice(0, 110)
  if (!issues.length && !commits.length) {
    const lead = leadIn(block)
    if (!(lead && noteFlat.includes(lead))) manual.push(`${section}: ${summary}`)
    continue
  }
  const label = `${section} [${issues.map((n) => `#${n}`).join(' ')}]: ${summary}`
  const byCommit = commits.some((h) => noteCommits.some((c) => sameCommit(h, c)))
  const byIssue = issues.filter((n) => noteIssues.has(n))
  if (byCommit || byIssue.some((n) => citations.get(n) === 1)) continue
  if (byIssue.length) shared.push(label)
  else missing.push(label)
}

console.log(`Not in the note (${missing.length}):`)
for (const line of missing) console.log(`  - ${line}`)
console.log(`\nShared issue: the note cites it, but check this entry by hand (${shared.length}):`)
for (const line of shared) console.log(`  - ${line}`)
console.log(`\nNo reference, check by hand (${manual.length}):`)
for (const line of manual) console.log(`  - ${line}`)
console.log(
  '\nFor each line, write "note line N" or a reason it stays changelog-only (internal, CI, admin-only).'
)
