import { countBucket, plural } from '../frame'
import { inBubble, outBubble } from '../parts'
import { chatFrame, innerWidth, roomName } from './chatPanel'
import type { KindResolver } from './types'

const PANEL_W = 420

/** The room name beside a small fixed conversation, with the bucketed message count. */
export const resolveChat: KindResolver = async (source) => {
  const room = roomName(source)
  const count = source.facts.chat?.count ?? 0
  const bucket = countBucket(count)
  if (!room || !bucket) return null

  const header = `${bucket} ${plural(count, 'message', 'messages')}`
  const inner = innerWidth(PANEL_W)
  return {
    kind: 'chat',
    values: ['chat-panel', source.padName, room, bucket],
    ogTitle: `Chat: ${room} — ${source.padTitle}`,
    alt: `Chat: ${room} — ${source.padName}. ${header}`,
    build: () =>
      chatFrame({
        kind: 'chat',
        padName: source.padName,
        room,
        panelWidth: PANEL_W,
        header,
        bubbles: [
          inBubble(inner * 0.74, [100, 62]),
          outBubble(inner * 0.52, [100]),
          inBubble(inner * 0.46, [100]),
          outBubble(inner * 0.7, [100, 48])
        ]
      })
  }
}
