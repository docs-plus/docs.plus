// Lists every user-facing changelog entry of a release that the release note does not mention.
// An entry counts as covered when one of its issue numbers or commit hashes is in the note, or
// when its bold lead phrase is.
// Entries with no reference print under "check by hand". Usage:
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

const missing: string[] = []
const manual: string[] = []
let section = ''
for (const block of entry.split(/\n(?=### |- )/)) {
  const heading = block.match(/^### (\w+)/)
  if (heading) {
    section = heading[1]
    continue
  }
  if (!block.startsWith('- ') || !USER_FACING.has(section)) continue
  const summary = block.slice(2).replace(/\s+/g, ' ').slice(0, 110)
  const lead = leadIn(block)
  if (lead && noteFlat.includes(lead)) continue
  const issues = [...block.matchAll(/(?:#|\/issues\/)(\d{2,5})\b/g)].map((m) => m[1])
  const commits = [...block.matchAll(/\/commit\/([0-9a-f]{7,40})/g)].map((m) => m[1])
  if (!issues.length && !commits.length) {
    manual.push(`${section}: ${summary}`)
    continue
  }
  const covered =
    issues.some((n) => note.includes(`#${n}`) || note.includes(`/issues/${n})`)) ||
    commits.some((h) => note.includes(h))
  if (!covered)
    missing.push(`${section} [${[...new Set(issues)].map((n) => `#${n}`).join(' ')}]: ${summary}`)
}

console.log(`Not in the note (${missing.length}):`)
for (const line of missing) console.log(`  - ${line}`)
console.log(`\nNo reference, check by hand (${manual.length}):`)
for (const line of manual) console.log(`  - ${line}`)
console.log(
  '\nEach line goes in the note, or stays changelog-only for a reason you can name (internal, CI, admin-only).'
)
