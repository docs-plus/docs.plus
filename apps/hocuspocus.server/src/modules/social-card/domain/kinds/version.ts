import { container } from '@takumi-rs/helpers'

import { usableLine } from '../eligibility'
import { fitHead, HEAD_LINE, LADDER, widthOf } from '../fit'
import { cardDate, cardFrame, CONTENT_W, plural, read, row, stack, T, titleNode } from '../frame'
import type { StoredChangeSummary } from '../storedData'
import type { KindResolver } from './types'

const STAT = T.size.title
const GAP = T.space[6]
const format = (n: number) => n.toLocaleString('en-US')

interface Slot {
  numbers: { text: string; color: string }[]
  label: string
}

/** The stat slots in order: words, then sections added, changed, removed, moved. A zero is left out. */
const statSlots = (s: StoredChangeSummary): Slot[] => {
  const slots: Slot[] = []
  const words = [
    ...(s.wordsAdded > 0 ? [{ text: `+${format(s.wordsAdded)}`, color: T.successInk }] : []),
    ...(s.wordsRemoved > 0 ? [{ text: `−${format(s.wordsRemoved)}`, color: T.errorInk }] : [])
  ]
  if (words.length) {
    const [n, verb] = s.wordsAdded > 0 ? [s.wordsAdded, 'added'] : [s.wordsRemoved, 'removed']
    const label = words.length === 2 ? 'words' : `${plural(n, 'word', 'words')} ${verb}`
    slots.push({ numbers: words, label })
  }
  const sections: [number, string][] = [
    [s.sectionsAdded, 'added'],
    [s.sectionsModified, 'changed'],
    [s.sectionsRemoved, 'removed'],
    [s.sectionsMoved, 'moved']
  ]
  // Only the first section slot says "sections"; the rest name their verb.
  for (const [n, verb] of sections) {
    if (n <= 0) continue
    const label =
      slots.length === (words.length ? 1 : 0) ? `${plural(n, 'section', 'sections')} ${verb}` : verb
    slots.push({ numbers: [{ text: format(n), color: T.ink }], label })
  }
  return slots
}

/** "Version from <date>", the version's own Title, and what it changed. */
export const resolveVersion: KindResolver = async ({ padName, padTitle, facts, isDrawable }) => {
  const version = facts.version
  if (!version) return null
  const slots = statSlots(version.summary)
  // A version that changed nothing has nothing to show beyond the Document card.
  if (!slots.length) return null

  const eyebrow = `Version from ${cardDate(version.createdAt)}`
  const title = usableLine(version.summary.title, isDrawable) ?? padName
  const stats = slots.map((sl) => `${sl.numbers.map((n) => n.text).join(' ')} ${sl.label}`)
  return {
    kind: 'version',
    values: ['version-stats', eyebrow, title, ...stats],
    ogTitle: `${eyebrow} — ${padTitle}`,
    alt: `${eyebrow}: ${title}. ${stats.join(', ')}`,
    build: async () => {
      const space =
        (await widthOf('x x', STAT, T.weight.bold)) - (await widthOf('xx', STAT, T.weight.bold))
      const slotWidth = async (sl: Slot) => {
        const widths = await Promise.all(
          sl.numbers.map((n) => widthOf(n.text, STAT, T.weight.bold))
        )
        const numbersW = widths.reduce((a, b) => a + b, 0) + (sl.numbers.length - 1) * space
        return Math.max(numbersW, await widthOf(sl.label))
      }
      const kept: Slot[] = []
      let used = 0
      for (const sl of slots) {
        const add = (kept.length ? GAP : 0) + (await slotWidth(sl))
        if (used + add > CONTENT_W) break
        kept.push(sl)
        used += add
      }
      const statRow = container({
        style: { display: 'flex', gap: GAP, marginTop: T.space[4], flexShrink: 0 },
        children: kept.map((sl) =>
          stack([
            container({
              style: { display: 'flex', flexShrink: 0 },
              children: sl.numbers.map((n, j) =>
                read(n.text, {
                  size: STAT,
                  weight: T.weight.bold,
                  color: n.color,
                  lineHeight: T.lineHeight.title,
                  style: j ? { marginLeft: space } : {}
                })
              )
            }),
            read(sl.label, { color: T.ink70 })
          ])
        )
      })
      const head = await fitHead(title, LADDER.object, CONTENT_W, HEAD_LINE)
      return cardFrame(
        'version',
        [
          row([read(eyebrow, { color: T.ink70 })], {
            alignItems: 'baseline'
          }),
          titleNode(head, { marginTop: T.space[1.5] }),
          statRow
        ],
        'stack'
      )
    }
  }
}
