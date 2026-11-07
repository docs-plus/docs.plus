import { container, text } from '@takumi-rs/helpers'

import { graphemesOf } from '../../../lib/cardText'
import { CARD_FONT, measureFirstChild } from '../infra/renderer'
import { T } from './frame'

// Wide enough that no stored line (80 graphemes) wraps.
const PROBE_W = 8000

const probe = (
  line: string,
  width: number,
  size: number,
  weight: number,
  lineHeight: number,
  wrap: boolean,
  letterSpacing = 0
) =>
  measureFirstChild(
    container({
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width,
        fontFamily: CARD_FONT
      },
      children: [
        text({
          text: line,
          style: {
            fontSize: size,
            fontWeight: weight,
            lineHeight,
            letterSpacing,
            flexShrink: 0,
            ...(wrap ? { overflowWrap: 'anywhere' } : {})
          }
        })
      ]
    }),
    width
  )

/** One-line advance width, with emoji drawn as Twemoji, as the render draws them. */
export const widthOf = async (line: string, size: number, weight: number): Promise<number> =>
  (await probe(line, PROBE_W, size, weight, 1, false)).width

/** The longest grapheme prefix, plus "…", that `fits` accepts; "…" alone when none does. */
const longestPrefix = async (line: string, fits: (candidate: string) => Promise<boolean>) => {
  const parts = graphemesOf(line.replace(/…$/u, ''))
  let lo = 1
  let hi = parts.length - 1
  let best = '…'
  while (lo <= hi) {
    const k = (lo + hi) >> 1
    const candidate = parts.slice(0, k).join('').trimEnd() + '…'
    if (await fits(candidate)) {
      best = candidate
      lo = k + 1
    } else hi = k - 1
  }
  return best
}

/** The line, or its longest prefix plus "…" whose one-line width fits `max`. */
const fitOneLine = async (line: string, max: number, size: number, weight: number) => {
  const fits = async (candidate: string) => (await widthOf(candidate, size, weight)) <= max
  if (await fits(line)) return { text: line, cut: false }
  return { text: await longestPrefix(line, fits), cut: true }
}

interface LinesStyle {
  width: number
  lines: number
  size: number
  weight: number
  lineHeight: number
  letterSpacing?: number
}

// A line that holds a Twemoji is about 2.5% of the font size taller than a text line, so an
// emoji must not cost a step. Each line may run 10% over its box, at most 0.4 of a box in all:
// under half a box for any line count, so an extra line never fits and the count rounds true.
const EMOJI_LINE_SLACK = 0.1
const EMOJI_SLACK_MAX = 0.4

/** The longest grapheme prefix, plus "…" when cut, that wraps into at most `lines` lines. */
const fitLines = async (line: string, o: LinesStyle) => {
  const lineBox = o.size * o.lineHeight
  const max = (o.lines + Math.min(o.lines * EMOJI_LINE_SLACK, EMOJI_SLACK_MAX)) * lineBox
  const height = async (candidate: string) =>
    (await probe(candidate, o.width, o.size, o.weight, o.lineHeight, true, o.letterSpacing)).height
  const full = await height(line)
  if (full <= max) return { text: line, cut: false, lines: Math.round(full / lineBox) }
  const best = await longestPrefix(line, async (candidate) => (await height(candidate)) <= max)
  return { text: best, cut: true, lines: o.lines }
}

/**
 * Moves a cut back to the last space, unless that drops more than 40% of the kept text. A stop
 * before the "…" goes too, so a cut never reads "line.…".
 */
const backOff = (cut: string): string => {
  const kept = cut.replace(/…$/u, '').trimEnd()
  const space = kept.lastIndexOf(' ')
  const back = space > 0 && kept.length - space <= Math.max(4, kept.length * 0.4)
  const text = back ? kept.slice(0, space).replace(/[\s,;:·—–-]+$/u, '') : kept
  return text.replace(/\.+$/u, '') + '…'
}

/** One line, cut at a word when it can be. */
export const cutLine = async (
  line: string,
  max: number,
  size: number,
  weight: number
): Promise<{ text: string; cut: boolean }> => {
  const fit = await fitOneLine(line, max, size, weight)
  return fit.cut ? { text: backOff(fit.text), cut: true } : fit
}

interface TextStyle {
  size: number
  weight: number
  lineHeight: number
}

/** Up to `lines` lines, cut at a word when it can be. Pass `T.desc` for a card description. */
export const cutLines = async (line: string, width: number, lines: number, style: TextStyle) => {
  const fit = await fitLines(line, { width, lines, ...style })
  return fit.cut ? { ...fit, text: backOff(fit.text) } : fit
}

/** The width left for the foot's left part, beside the link and the gap. */
export const footLeftWidth = async (link: string): Promise<number> =>
  T.box.width - (await widthOf(link, T.link.size, T.link.weight)) - T.foot.gap

// Half a pixel of rounding in a room must not cost the headline a line.
const LINE_TOLERANCE = 0.5

export const linesIn = (height: number, size: number): number =>
  Math.floor((height + LINE_TOLERANCE) / (size * T.headline.lineHeight))

interface Headline {
  text: string
  size: number
  lines: number
  cut: boolean
}

/** The first step where the whole line fits in its lines; else the last step, cut at a word. */
export const fitHead = async (
  line: string,
  steps: readonly { size: number; lines: number }[]
): Promise<Headline> => {
  const { width, weight, letterSpacing, lineHeight } = T.headline
  for (const [i, step] of steps.entries()) {
    const fit = await fitLines(line, {
      width,
      lines: step.lines,
      size: step.size,
      weight,
      lineHeight,
      letterSpacing
    })
    if (fit.cut && i < steps.length - 1) continue
    const text = fit.cut ? backOff(fit.text) : fit.text
    return { ...fit, text, size: step.size }
  }
  throw new Error('no headline step fits the card body')
}
