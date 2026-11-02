import { container, image, text } from '@takumi-rs/helpers'
import { extractEmojis } from '@takumi-rs/helpers/emoji'

import type { IsDrawable } from '../eligibility'
import { cardDate, countBucket, over, plural, read, row, stack, strokeSvg, T } from '../frame'
import { inBubble, outBubble } from '../parts'
import { chatFrame, innerWidth, roomName } from './chatPanel'
import type { KindResolver } from './types'

// Wider than the Chat panel: the lit message carries its reaction and its reply line.
const PANEL_W = 480
const FOOT_H = 54
// The app's deep-link highlight (.msg_card--flash at rest) and its edge bar.
const FLASH = over(T.primary, 0.16, T.paper)
const FLASH_BAR = over(T.primary, 0.85, FLASH)

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

const REPLY_PATHS = '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>'

/** The chat panel with the linked message lit, as the app lights a jumped-to message. */
export const resolveMessage: KindResolver = async (source) => {
  const message = source.facts.chat?.message
  const room = roomName(source)
  if (!message || !room || message.type === 'notice' || message.type === 'notification') {
    return null
  }

  const day = cardDate(message.createdAt)
  const reaction = topReaction(message.reactions, source.isDrawable)
  const reactionCount = reaction ? countBucket(reaction[1]) : null
  const replies = countBucket(message.replies)
  const repliesText = replies ? `${replies} ${plural(message.replies, 'reply', 'replies')}` : null
  const inner = innerWidth(PANEL_W)

  return {
    kind: 'message',
    values: [
      'message-panel',
      source.padName,
      room,
      day,
      reaction && reactionCount ? `${reaction[0]}${reactionCount}` : '',
      repliesText ?? ''
    ],
    ogTitle: `Chat: ${room} — ${source.padTitle}`,
    alt: `A message in ${room} — ${source.padName}, ${day}`,
    build: () => {
      const foot = [
        ...(reaction && reactionCount
          ? [
              row(
                [
                  read(reaction[0], { lineHeight: 1 }),
                  read(reactionCount, { weight: T.weight.semibold, lineHeight: 1 })
                ],
                {
                  gap: T.space[1],
                  height: FOOT_H,
                  paddingLeft: T.space[2],
                  paddingRight: T.space[2.5],
                  backgroundColor: T.border,
                  borderRadius: T.radiusField
                }
              )
            ]
          : []),
        ...(repliesText
          ? [
              row(
                [
                  image({
                    src: strokeSvg('card:reply', REPLY_PATHS, over(T.ink, 0.5, T.paper), 2),
                    width: 36,
                    height: 36,
                    style: { flexShrink: 0 }
                  }),
                  read(repliesText, { color: T.ink70, lineHeight: 1 })
                ],
                { gap: T.space[1.5], height: FOOT_H }
              )
            ]
          : [])
      ]
      const lit = row(
        [
          container({
            style: { width: 8, alignSelf: 'stretch', backgroundColor: FLASH_BAR, flexShrink: 0 }
          }),
          stack(
            [
              inBubble(inner * 0.7, [100, 58], over(T.ink, 0.1, FLASH)),
              ...(foot.length ? [row(foot, { gap: T.space[2], marginTop: T.space[1] })] : [])
            ],
            {
              padding: T.space[1],
              paddingLeft: T.space[1.5],
              paddingRight: T.space[1.5],
              flexGrow: 1
            }
          )
        ],
        {
          alignItems: 'stretch',
          width: '100%',
          backgroundColor: FLASH,
          borderRadius: T.radiusField,
          overflow: 'hidden'
        }
      )
      return chatFrame({
        kind: 'message',
        padName: source.padName,
        room,
        panelWidth: PANEL_W,
        header: day,
        bubbles: [inBubble(inner * 0.5, [100]), outBubble(inner * 0.42, [100]), lit]
      })
    }
  }
}
