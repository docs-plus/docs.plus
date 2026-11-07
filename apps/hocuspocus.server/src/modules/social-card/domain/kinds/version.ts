import { cardDate, plural } from '../../../../lib/cardText'
import { cardFrame } from '../../render/frame'
import { factRow, fitMiddle } from '../../render/parts'
import { usableLine } from '../eligibility'
import type { StoredChangeSummary } from '../storedData'
import { altSentences } from './text'
import type { KindResolver } from './types'

const LINK = 'See what changed →'
const format = (n: number) => n.toLocaleString('en-US')

/**
 * One chip per change, in order: words, then sections added, changed, removed, moved. A zero is
 * left out. "+120 words", "+5 −3 words", "3 sections changed".
 */
const statChips = (s: StoredChangeSummary): string[] => {
  const words = [
    ...(s.wordsAdded > 0 ? [`+${format(s.wordsAdded)}`] : []),
    ...(s.wordsRemoved > 0 ? [`−${format(s.wordsRemoved)}`] : [])
  ]
  const sections: [number, string][] = [
    [s.sectionsAdded, 'added'],
    [s.sectionsModified, 'changed'],
    [s.sectionsRemoved, 'removed'],
    [s.sectionsMoved, 'moved']
  ]
  const chips: string[] = []
  if (words.length) {
    const n = s.wordsAdded > 0 ? s.wordsAdded : s.wordsRemoved
    chips.push(`${words.join(' ')} ${words.length === 2 ? 'words' : plural(n, 'word', 'words')}`)
  }
  for (const [count, verb] of sections) {
    if (count > 0) chips.push(`${format(count)} ${plural(count, 'section', 'sections')} ${verb}`)
  }
  return chips
}

/** "Version from <date>", the version's own Title, and one chip per change it made. */
export const resolveVersion: KindResolver = async (source) => {
  const { padName, facts, isDrawable } = source
  const version = facts.version
  if (!version) return null
  const stats = statChips(version.summary)
  // A version that changed nothing has nothing to show beyond the Document card.
  if (!stats.length) return null

  const day = cardDate(version.createdAt)
  const eyebrow = `Version from ${day}`
  const title = usableLine(version.summary.title, isDrawable) ?? padName
  return {
    kind: 'version',
    values: [eyebrow, title, ...stats],
    ogTitle: `${eyebrow} — ${padName}`,
    ogDescription: `A saved version of ${padName} from ${day}.`,
    alt: altSentences([title, eyebrow]),
    build: async () =>
      cardFrame({
        eyebrow,
        title: (await fitMiddle(title, null, true)).title,
        footLeft: await factRow(stats, LINK),
        link: LINK
      })
  }
}
