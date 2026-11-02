// `frame`, `fit` and `parts` are the render layer: they build and measure Takumi trees, so they
// import the renderer and the assets. The kind resolvers stay free of both.
import type { Node } from '@takumi-rs/core'
import { container, image, text } from '@takumi-rs/helpers'

import { LOGO_SRC, registerSvg } from '../infra/assets'
import { CARD_FONT, CARD_HEIGHT, CARD_WIDTH } from '../infra/renderer'
import type { CardKind } from './cardRequest'

// The card is the app at 2.5x, in its light theme tokens (apps/webapp/src/styles/globals.scss).
const S = 2.5

const hexToRgb = (hex: string): number[] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (rgb: number[]) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('')

/** Paints `fg` at `alpha` over an opaque ground, as a browser paints a `/70` class. */
export const over = (fg: string, alpha: number, ground: string): string => {
  const g = hexToRgb(ground)
  return toHex(hexToRgb(fg).map((c, i) => Math.round(c * alpha + g[i] * (1 - alpha))))
}

const toLinear = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) =>
  Math.round(
    255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
  )
const toOklab = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}
const fromOklab = ([L, a, b]: number[]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return toHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ].map(fromLinear)
  )
}
/** CSS `color-mix(in oklab, a, b p%)`, for the tokens the app defines that way. */
export const mixOklab = (a: string, b: string, p: number): string => {
  const A = toOklab(a)
  const B = toOklab(b)
  return fromOklab(A.map((v, i) => v * (1 - p) + B[i] * p))
}

const INK = '#0f172a' // --color-base-content
const PRIMARY = '#1a73e8' // --color-primary

export const T = {
  paper: '#ffffff', // --color-base-100
  well: '#eef1f6', // --color-base-200
  border: '#dce3ed', // --color-base-300
  ink: INK,
  ink70: 'rgba(15,23,42,0.7)', // text-base-content/70
  primary: PRIMARY, // graphics only, never text
  info: '#0284c7', // --color-info: the filter chips
  successInk: mixOklab('#16a34a', INK, 0.4), // --success-ink
  errorInk: mixOklab('#dc2626', INK, 0.25), // --error-ink
  radiusBox: 10 * S,
  radiusField: 8 * S,
  hairline: 1 * S,
  size: {
    read: 18 * S,
    title: 24 * S,
    padHeading: ((24 * 4) / 3) * S,
    padTitle: ((28 * 4) / 3) * S
  },
  lineHeight: { title: 1.15, read: 1.35 },
  weight: { regular: 400, semibold: 600, bold: 700 },
  space: { 1: 4 * S, 1.5: 6 * S, 2: 8 * S, 2.5: 10 * S, 3: 12 * S, 4: 16 * S, 5: 20 * S, 6: 24 * S }
} as const

const MARK_TOP = T.space[4]
const MARK_H = 28 * S
const PAD_X = T.space[6]
const LOGO_H = 24 * S
const LOGO_W = Math.round((LOGO_H * 1954.69) / 2508.26) // logo.svg viewBox
const SHEET_GAP = T.space[3]
const SHEET_TOP = MARK_TOP + MARK_H + SHEET_GAP
// Text ends above y 590, inside the band a 2:1 crop keeps.
const CONTENT_BOTTOM = 590
// The sheet runs off the bottom edge, so its lower corners never show.
const SHEET_BLEED = 30

/** Measured body box: Takumi lays the 2.5 px sheet border out as 2 px per side. */
export const CONTENT_W = 956
export const BODY_H = 386
export const READ_LH = T.size.read * T.lineHeight.read
/** One 45 px read line. */
export const LINE_H = Math.ceil(READ_LH)
/** One TOC nest step. */
export const NEST = T.space[5]
const HEAD_GAP = T.space[1]
/** What the TOC header adds under its text. */
export const HEAD_EXTRA = 2 * HEAD_GAP + T.hairline
/** Gap between the page column and a side column. */
export const COL_GAP = T.space[3]

// Lucide paths as the app ships them (react-icons `lu`, stroke width 2).
const LUCIDE = {
  heading:
    '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
  chatroom:
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  history:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'
} as const
type IconName = keyof typeof LUCIDE

/** A Lucide icon as an SVG image, with the colour baked in: an image has no `currentColor`. */
export const icon = (name: IconName, size: number, opacity: number): Node => {
  const src = `icon:${name}:${INK}:${opacity}`
  registerSvg(
    src,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-opacity="${opacity}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${LUCIDE[name]}</svg>`
  )
  return image({ src, width: size, height: size, style: { flexShrink: 0 } })
}

/** Registers an inline SVG with its own stroke colour and returns its src: the reply glyph, the task check. */
export const strokeSvg = (src: string, paths: string, stroke: string, strokeWidth: number) =>
  registerSvg(
    src,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
  )

interface TextOptions {
  size?: number
  weight?: number
  color?: string
  lineHeight?: number
  style?: Record<string, unknown>
}

/** One drawn line. Callers pass only lines that went through `usableLine`. */
export const read = (line: string, o: TextOptions = {}): Node =>
  text({
    text: line,
    style: {
      fontSize: o.size ?? T.size.read,
      fontWeight: o.weight ?? T.weight.regular,
      color: o.color ?? T.ink,
      lineHeight: o.lineHeight ?? T.lineHeight.read,
      flexShrink: 0,
      overflowWrap: 'anywhere',
      ...o.style
    }
  })

export const muted = (line: string, style: Record<string, unknown> = {}, lineHeight?: number) =>
  read(line, { color: T.ink70, lineHeight, style })

/** A fitted headline at its ladder step. */
export const titleNode = (
  fit: { text: string; size: number },
  style: Record<string, unknown> = {}
) =>
  read(fit.text, {
    size: fit.size,
    weight: T.weight.bold,
    lineHeight: T.lineHeight.title,
    style
  })

export const row = (children: Node[], style: Record<string, unknown> = {}): Node =>
  container({
    style: { display: 'flex', alignItems: 'center', flexShrink: 0, ...style },
    children
  })

export const stack = (children: Node[], style: Record<string, unknown> = {}): Node =>
  container({
    style: { display: 'flex', flexDirection: 'column', flexShrink: 0, ...style },
    children
  })

/** The page column on the left, a side column on the right. */
export const split = (left: Node, right: Node, leftW: number): Node =>
  container({
    style: { display: 'flex', gap: COL_GAP, height: BODY_H, width: CONTENT_W, flexShrink: 0 },
    children: [
      container({
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: leftW,
          flexShrink: 0
        },
        children: [left]
      }),
      right
    ]
  })

/** The kind label the card carries at the top right. The Document card carries none. */
const KIND_LABEL: Record<CardKind, { words: string; icon: IconName } | null> = {
  document: null,
  heading: { words: 'Heading', icon: 'heading' },
  chat: { words: 'Chat', icon: 'chatroom' },
  message: { words: 'Message', icon: 'chatroom' },
  filter: { words: 'Filtered view', icon: 'filter' },
  version: { words: 'Version history', icon: 'history' }
}

const kindLabel = (kind: CardKind): Node | null => {
  const label = KIND_LABEL[kind]
  if (!label) return null
  return row(
    [
      icon(label.icon, 16 * S, 0.7),
      read(label.words, { weight: T.weight.semibold, color: T.ink70, lineHeight: 1 })
    ],
    {
      gap: T.space[2],
      height: MARK_H,
      paddingLeft: T.space[2.5],
      paddingRight: T.space[3],
      borderRadius: T.radiusField,
      border: `${T.hairline}px solid ${T.border}`,
      backgroundColor: T.paper,
      marginLeft: 'auto'
    }
  )
}

/**
 * The family frame: the docs.plus mark and the kind label on the well, and a sheet that runs
 * off the bottom edge. `centre` centres the body in the sheet; `stack` puts it at the top.
 */
export const cardFrame = (
  kind: CardKind,
  body: Node[],
  place: 'centre' | 'stack' = 'centre'
): Node => {
  const label = kindLabel(kind)
  return container({
    style: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: T.well,
      paddingTop: MARK_TOP,
      paddingLeft: PAD_X,
      paddingRight: PAD_X,
      overflow: 'hidden',
      fontFamily: CARD_FONT
    },
    children: [
      row(
        [
          image({ src: LOGO_SRC, width: LOGO_W, height: LOGO_H }),
          read('docs.plus', {
            weight: T.weight.bold,
            lineHeight: 1,
            style: { marginLeft: T.space[2] }
          }),
          ...(label ? [label] : [])
        ],
        { height: MARK_H }
      ),
      container({
        style: {
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          marginTop: SHEET_GAP,
          height: CARD_HEIGHT - SHEET_TOP + SHEET_BLEED,
          paddingTop: PAD_X,
          paddingLeft: PAD_X,
          paddingRight: PAD_X,
          paddingBottom: CARD_HEIGHT + SHEET_BLEED - CONTENT_BOTTOM,
          backgroundColor: T.paper,
          border: `${T.hairline}px solid ${T.border}`,
          borderRadius: T.radiusBox,
          ...(place === 'centre' ? { justifyContent: 'center' } : {})
        },
        children: [
          container({
            style: {
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 0,
              flexShrink: 1,
              minHeight: 0,
              overflow: 'hidden'
            },
            children: body
          })
        ]
      })
    ]
  })
}

/** The one plural rule for card text. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** The one count rule for values that grow: 1 to 9 exact, then "10+". Null for 0. */
export const countBucket = (n: number): string | null => {
  if (!Number.isFinite(n) || n <= 0) return null
  return n >= 10 ? '10+' : String(Math.floor(n))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "28 Oct 2026", a UTC day: one value for every viewer, so one `cardVersion`. */
export const cardDate = (date: Date): string =>
  `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
