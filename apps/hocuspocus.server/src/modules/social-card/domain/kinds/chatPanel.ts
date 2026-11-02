import type { Node } from '@takumi-rs/core'

import type { CardKind } from '../cardRequest'
import { cutLine, fitHead, LADDER } from '../fit'
import {
  BODY_H,
  cardFrame,
  COL_GAP,
  CONTENT_W,
  icon,
  LINE_H,
  muted,
  read,
  READ_LH,
  row,
  split,
  stack,
  T,
  titleNode
} from '../frame'
import { conversation, namedSection } from '../parts'
import type { CardSource } from './types'

/**
 * The room name: the stored text of the channel's heading. The pad's own room has no heading
 * and no name of its own in the app, so it gets no card. Null also when the name is the pad name.
 */
export const roomName = (source: CardSource): string | null =>
  namedSection(source, source.facts.chat?.headingId)?.name ?? null

/**
 * The docked chat sketch. The pad name and the room name sit on the left. The base-200
 * panel sits on the right, with a header and fixed bubbles at the bottom.
 */
export const chatFrame = async (args: {
  kind: CardKind
  padName: string
  room: string
  panelWidth: number
  header: string
  bubbles: Node[]
}): Promise<Node> => {
  const leftW = CONTENT_W - args.panelWidth - COL_GAP
  const context = await cutLine(args.padName, leftW)
  const head = await fitHead(args.room, LADDER.object, leftW, BODY_H - READ_LH - T.space[1])
  const left = stack([muted(context.text, { marginBottom: T.space[1] }), titleNode(head)], {
    width: leftW
  })
  const header = row(
    [
      icon('chatroom', T.size.read, 0.7),
      read(args.header, { weight: T.weight.semibold, lineHeight: 1 })
    ],
    {
      gap: T.space[1.5],
      height: LINE_H,
      width: '100%',
      paddingBottom: T.space[1],
      borderBottom: `${T.hairline}px solid ${T.border}`,
      marginBottom: T.space[1.5]
    }
  )
  const panel = stack([header, conversation(args.bubbles)], {
    width: args.panelWidth,
    height: BODY_H,
    backgroundColor: T.well,
    borderRadius: T.radiusBox,
    paddingTop: T.space[1.5],
    paddingBottom: T.space[2.5],
    paddingLeft: T.space[2.5],
    paddingRight: T.space[2.5]
  })
  return cardFrame(args.kind, [split(left, panel, leftW)])
}

/** Bubble widths are shares of the panel's inner width. */
export const innerWidth = (panelWidth: number) => panelWidth - 2 * T.space[2.5]
