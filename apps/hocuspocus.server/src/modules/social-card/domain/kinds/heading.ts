import { cutLine, fitHead, LADDER } from '../../render/fit'
import {
  BODY_H,
  cardFrame,
  CONTENT_W,
  LINE_H,
  muted,
  READ_LH,
  T,
  titleNode
} from '../../render/frame'
import { altSentences, blockLines, firstLines, lineValue, namedSection } from '../../render/parts'
import type { KindResolver } from './types'

/** The Document card for one section: the pad name, the heading as the title, its first blocks. */
export const resolveHeading: KindResolver = async (source) => {
  const section = namedSection(source, source.query.id)
  if (!section) return null
  const { item, name: heading } = section
  const { padName, padTitle, isDrawable } = source

  const lines = firstLines(item.blocks, isDrawable)
  return {
    kind: 'heading',
    values: ['heading-section', padName, heading, ...lines.map(lineValue)],
    ogTitle: `${heading} — ${padTitle}`,
    alt: altSentences([`${heading} — ${padName}`, ...lines.slice(0, 2).map((l) => l.text)]),
    build: async () => {
      const contextH = READ_LH + T.space[1]
      const gap = lines.length ? T.space[3] : 0
      const minBlocks = Math.min(2, lines.length) * LINE_H + gap
      const head = await fitHead(heading, LADDER.object, CONTENT_W, BODY_H - contextH - minBlocks)
      const context = await cutLine(padName, CONTENT_W)
      const blocks = await blockLines(lines, BODY_H - contextH - head.height - gap)
      return cardFrame('heading', [
        muted(context.text, { marginBottom: T.space[1] }),
        titleNode(head, { marginBottom: gap }),
        ...blocks
      ])
    }
  }
}
