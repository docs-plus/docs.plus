// `render/` holds `frame`, `fit` and `parts`: they build and measure Takumi trees, so they import
// the renderer and the assets. `domain/` never imports `infra/renderer` or `infra/assets` directly.
import type { Node } from '@takumi-rs/core'
import { container, image, text } from '@takumi-rs/helpers'

import { BACKGROUND_SRC, LOGO_SRC } from '../infra/assets'
import { CARD_FONT, CARD_HEIGHT, CARD_WIDTH } from '../infra/renderer'

// Drawn values at the full 1200 × 630 card size.
const box = { x: 66, y: 58, width: 1068 }
// The card's logo.svg keeps the 2688-unit square canvas of apps/webapp/public/icons/logo.svg,
// so the logo box holds it whole; the inset pulls that canvas's blank left edge back.
const wordmark = { size: 42, weight: 800, letterSpacing: -0.8, gap: 12, logo: 62, logoInset: -8 }
// Inter's own line box is 1.21 of the font size; one-line text sets it, so its height is known.
const eyebrow = { size: 36, weight: 700, lineHeight: 1.21, marginBottom: 14 }
const people = {
  dots: ['#1a73e8', '#16a34a', '#eab308', '#ea580c', '#dc2626'],
  dot: 64,
  ring: 6,
  overlap: 18,
  gap: 28,
  size: 44,
  weight: 800
}
const chip = {
  padY: 10,
  padX: 26,
  size: 34,
  weight: 700,
  lineHeight: 1.21,
  border: 2,
  gap: 18,
  filterFill: '#dbe7fb',
  filterInk: '#1557b0'
}
/** The tallest foot: a fact chip, or the people dots. */
const FOOT_H = Math.max(people.dot, 2 * (chip.padY + chip.border) + chip.size * chip.lineHeight)
/** The least space above and below the middle, so it never touches the mark or the foot. */
const MIDDLE_GAP = 16

export const T = {
  paper: '#ffffff',
  border: '#dce3ed',
  ink: '#0f172a',
  inkSoft: '#475569',
  inkFaint: '#64748b',
  /** Graphics and the link only. */
  primary: '#1a73e8',
  /** The content box; the rest of the card is margin. */
  box,
  /** The height the middle may fill: the eyebrow, the title and what sits under it. */
  middle: CARD_HEIGHT - 2 * box.y - wordmark.logo - FOOT_H - 2 * MIDDLE_GAP,
  headline: {
    steps: [
      { size: 104, lines: 2 },
      { size: 88, lines: 2 },
      { size: 72, lines: 3 }
    ],
    weight: 900,
    letterSpacing: -3,
    lineHeight: 1.02,
    width: 1020
  },
  desc: { size: 38, weight: 400, lineHeight: 1.28, marginTop: 20, width: 900 },
  eyebrow,
  wordmark,
  people,
  sections: { size: 36, weight: 600, lineHeight: 1.35 },
  /** The filter card's chip row, and the matching section names under it. */
  filter: { marginBottom: 22, size: 44, weight: 800 },
  link: { size: 34, weight: 700 },
  foot: { gap: 30 },
  chip
} as const

interface TextOptions {
  size: number
  weight: number
  lineHeight: number
  color?: string
  style?: Record<string, unknown>
}

/** One drawn line. Callers pass only lines that went through `usableLine`. */
export const read = (line: string, o: TextOptions): Node =>
  text({
    text: line,
    style: {
      fontSize: o.size,
      fontWeight: o.weight,
      color: o.color ?? T.ink,
      lineHeight: o.lineHeight,
      flexShrink: 0,
      overflowWrap: 'anywhere',
      ...o.style
    }
  })

/**
 * A fitted headline at its ladder step, drawn with the style `fitHead` measured. The width is
 * set on the text: in a flex row, a text with no width never wraps and clips with no "…".
 */
export const titleNode = (fit: { text: string; size: number }): Node =>
  read(fit.text, {
    size: fit.size,
    weight: T.headline.weight,
    lineHeight: T.headline.lineHeight,
    style: { letterSpacing: T.headline.letterSpacing, width: T.headline.width }
  })

export const row = (children: Node[], style: Record<string, unknown> = {}): Node =>
  container({
    style: { display: 'flex', alignItems: 'center', flexShrink: 0, ...style },
    children
  })

const stack = (children: Node[], style: Record<string, unknown> = {}): Node =>
  container({
    style: { display: 'flex', flexDirection: 'column', flexShrink: 0, ...style },
    children
  })

/** One line that never wraps, at the line height the font gives. */
const oneLine = (line: string, style: Record<string, unknown>): Node =>
  text({ text: line, style: { flexShrink: 0, whiteSpace: 'nowrap', ...style } })

/**
 * The content card: the glow background with the faint logo, then a column of the mark, the
 * middle and the foot, spread from top to bottom. An `eyebrow` too long for one line ends in
 * "…". The width left for `footLeft` is `footLeftWidth(link)`.
 */
export const cardFrame = (args: {
  eyebrow?: string
  title: Node
  under?: Node[]
  footLeft?: Node
  link: string
}): Node => {
  const { box, wordmark } = T
  return container({
    style: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: CARD_FONT,
      color: T.ink
    },
    children: [
      image({
        src: BACKGROUND_SRC,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        style: { position: 'absolute', left: 0, top: 0 }
      }),
      // Positioned too, so it paints after the background, not under it.
      container({
        style: {
          position: 'relative',
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: box.y,
          paddingBottom: box.y,
          paddingLeft: box.x,
          paddingRight: CARD_WIDTH - box.x - box.width
        },
        children: [
          row(
            [
              image({
                src: LOGO_SRC,
                width: wordmark.logo,
                height: wordmark.logo,
                style: { marginLeft: wordmark.logoInset }
              }),
              oneLine('docs.plus', {
                fontSize: wordmark.size,
                fontWeight: wordmark.weight,
                letterSpacing: wordmark.letterSpacing
              })
            ],
            { gap: wordmark.gap }
          ),
          stack(
            [
              ...(args.eyebrow
                ? [
                    oneLine(args.eyebrow, {
                      fontSize: T.eyebrow.size,
                      fontWeight: T.eyebrow.weight,
                      lineHeight: T.eyebrow.lineHeight,
                      color: T.inkFaint,
                      marginBottom: T.eyebrow.marginBottom,
                      maxWidth: box.width,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    })
                  ]
                : []),
              args.title,
              ...(args.under ?? [])
            ],
            { width: box.width }
          ),
          row(
            [
              ...(args.footLeft
                ? [
                    container({
                      style: { display: 'flex', flexShrink: 1, minWidth: 0, overflow: 'hidden' },
                      children: [args.footLeft]
                    })
                  ]
                : []),
              oneLine(args.link, {
                fontSize: T.link.size,
                fontWeight: T.link.weight,
                color: T.primary,
                marginLeft: 'auto'
              })
            ],
            { width: box.width, gap: T.foot.gap }
          )
        ]
      })
    ]
  })
}

/** Five plain colour dots, never faces, then the label. The row never wraps. */
export const peopleRow = (label: string): Node => {
  const p = T.people
  return row(
    [
      row(
        p.dots.map((colour, i) =>
          container({
            style: {
              width: p.dot,
              height: p.dot,
              boxSizing: 'border-box',
              borderRadius: 999,
              border: `${p.ring}px solid ${T.paper}`,
              backgroundColor: colour,
              backgroundClip: 'padding-box',
              marginLeft: i ? -p.overlap : 0,
              flexShrink: 0
            }
          })
        )
      ),
      oneLine(label, { fontSize: p.size, fontWeight: p.weight })
    ],
    { gap: p.gap }
  )
}

const pill = (line: string, fill: string, edge: string, ink: string): Node =>
  container({
    style: {
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      paddingTop: T.chip.padY,
      paddingBottom: T.chip.padY,
      paddingLeft: T.chip.padX,
      paddingRight: T.chip.padX,
      borderRadius: 999,
      border: `${T.chip.border}px solid ${edge}`,
      backgroundColor: fill
    },
    children: [
      oneLine(line, {
        fontSize: T.chip.size,
        fontWeight: T.chip.weight,
        lineHeight: T.chip.lineHeight,
        color: ink
      })
    ]
  })

/** A white pill with one fact: a count, a reaction, a change stat. */
export const factChip = (line: string): Node => pill(line, T.paper, T.border, T.ink)

/**
 * One filter term, or the white `+N` chip after the last one shown. The term chip's border takes
 * its fill colour, so both chips are the same height.
 */
export const filterChip = (line: string, more = false): Node =>
  more
    ? pill(line, T.paper, T.border, T.inkSoft)
    : pill(line, T.chip.filterFill, T.chip.filterFill, T.chip.filterInk)
