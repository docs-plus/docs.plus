import { text } from '@takumi-rs/helpers'
import { extractEmojis } from '@takumi-rs/helpers/emoji'

import { countBucket, plural } from '../../../../lib/cardText'
import { cardFrame } from '../../render/frame'
import { eyebrowLine, factRow, fitMiddle } from '../../render/parts'
import type { IsDrawable } from '../eligibility'
import { altSentences, eyebrowText, roomName } from './text'
import type { KindResolver } from './types'

const TITLE = 'A message was shared with you'
const LINK = 'See the message →'

/**
 * People stay off the card: skin tones, joiners, faces and figures. Hand gestures such as 👍
 * stay, because the plain gesture shows no person.
 */
const PERSON =
  /\p{Emoji_Modifier}|\u200d|[\u{1F3C3}\u{1F3C4}\u{1F3C7}\u{1F3CA}-\u{1F3CC}\u{1F464}-\u{1F487}\u{1F48F}\u{1F491}\u{1F574}\u{1F575}\u{1F57A}\u{1F5E3}\u{1F645}-\u{1F64F}\u{1F6A3}-\u{1F6B6}\u{1F6C0}\u{1F6CC}\u{1F926}-\u{1F937}\u{1F9B8}\u{1F9B9}\u{1F9D1}-\u{1F9DD}\u{1FAC3}-\u{1FAC5}]/u

/** A reaction key is free text in the database, so only one whole emoji may reach the card. */
const isOneEmoji = (key: string): boolean => {
  const tree = extractEmojis(text(key), 'twemoji')
  return (
    tree.type === 'container' && tree.children?.length === 1 && tree.children[0].type === 'image'
  )
}

/** The top reaction by count that is one drawable emoji and shows no person, or null. */
export const topReaction = (
  reactions: Record<string, number>,
  isDrawable: IsDrawable
): [string, number] | null => {
  const ranked = Object.entries(reactions)
    .filter(([emoji, n]) => n > 0 && isOneEmoji(emoji) && !PERSON.test(emoji) && isDrawable(emoji))
    .sort((a, b) => b[1] - a[1])
  return ranked[0] ?? null
}

/** A shared message: never its text or author, only its top reaction and its reply count. */
export const resolveMessage: KindResolver = async (source) => {
  const message = source.facts.chat?.message
  const room = roomName(source)
  if (!message || !room || message.type === 'notice' || message.type === 'notification') {
    return null
  }
  const { padName } = source

  const reaction = topReaction(message.reactions, source.isDrawable)
  const reactionCount = reaction ? countBucket(reaction[1]) : null
  const reactionFact = reaction && reactionCount ? `${reaction[0]} ${reactionCount}` : null
  const replies = countBucket(message.replies)
  const repliesFact = replies ? `${replies} ${plural(message.replies, 'reply', 'replies')}` : null
  const facts = [reactionFact, repliesFact].filter((f): f is string => f !== null)

  return {
    kind: 'message',
    values: [padName, room, reactionFact ?? '', repliesFact ?? ''],
    ogTitle: `Chat: ${room} — ${padName}`,
    ogDescription: `A message from the ${padName} chat.`,
    alt: altSentences([TITLE, eyebrowText([padName, room])]),
    build: async () =>
      cardFrame({
        eyebrow: await eyebrowLine(padName, ` › ${room}`),
        title: (await fitMiddle(TITLE, null, true)).title,
        footLeft: await factRow(facts, LINK),
        link: LINK
      })
  }
}
