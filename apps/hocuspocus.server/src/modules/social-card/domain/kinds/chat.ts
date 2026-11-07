import { cardFrame, factChip } from '../../render/frame'
import { eyebrowLine, fitMiddle } from '../../render/parts'
import { altSentences, eyebrowText, messageCount, roomName } from './text'
import type { KindResolver } from './types'

const LINK = 'Join the conversation →'
const UNDER = 'A conversation about this section.'

/** A section's chat room: the room name as the title, with the bucketed message count. */
export const resolveChat: KindResolver = async (source) => {
  const room = roomName(source)
  const count = source.facts.chat ? messageCount(source.facts.chat) : null
  if (!room || !count) return null
  const { padName } = source
  const fact = `💬 ${count}`

  return {
    kind: 'chat',
    values: [padName, room, fact],
    ogTitle: `Chat: ${room} — ${padName}`,
    ogDescription: `A conversation on a section of ${padName}. ${count}.`,
    alt: altSentences([room, eyebrowText([padName, 'Chat'])]),
    build: async () => {
      const { title, under } = await fitMiddle(room, UNDER, true)
      return cardFrame({
        eyebrow: await eyebrowLine(padName, ' › Chat'),
        title,
        under,
        footLeft: factChip(fact),
        link: LINK
      })
    }
  }
}
