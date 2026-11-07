import { cardFrame, factChip } from '../../render/frame'
import { eyebrowLine, fitMiddle } from '../../render/parts'
import { altSentences, eyebrowText, firstLines, messageCount, namedSection, sameText } from './text'
import type { KindResolver } from './types'

const LINK = 'Open the section →'

/** One section: the pad name above, the heading as the title, its first line, its chat count. */
export const resolveHeading: KindResolver = async (source) => {
  const section = namedSection(source, source.query.id)
  if (!section) return null
  const { item, name: heading } = section
  const { padName, isDrawable } = source

  const desc =
    firstLines(item.blocks, isDrawable).find((line) => !sameText(line.text, heading))?.text ?? null
  // The link read also matches a channel id, so the count is drawn only for this heading's room.
  const chat = source.facts.chat
  const count = chat && chat.headingId === item.id ? messageCount(chat) : null
  const fact = count ? `💬 ${count}` : null
  return {
    kind: 'heading',
    values: [padName, heading, desc ?? '', fact ?? ''],
    ogTitle: `${heading} — ${padName}`,
    ogDescription: `A section of ${padName}, with its own chat.`,
    alt: altSentences([heading, eyebrowText([padName])]),
    build: async () => {
      const { title, under } = await fitMiddle(heading, desc, true)
      return cardFrame({
        eyebrow: await eyebrowLine(padName, ' ›'),
        title,
        under,
        footLeft: fact ? factChip(fact) : undefined,
        link: LINK
      })
    }
  }
}
