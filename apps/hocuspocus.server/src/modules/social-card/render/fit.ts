import { container, text } from '@takumi-rs/helpers'

import { graphemesOf } from '../domain/storedData'
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
  wrap: boolean
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
            flexShrink: 0,
            ...(wrap ? { overflowWrap: 'anywhere' } : {})
          }
        })
      ]
    }),
    width
  )

/** One-line advance width, with emoji drawn as Twemoji, as the render draws them. */
export const widthOf = async (
  line: string,
  size: number = T.size.read,
  weight: number = T.weight.regular
): Promise<number> => (await probe(line, PROBE_W, size, weight, 1, false)).width

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
}

/** The longest grapheme prefix, plus "…" when cut, that wraps into at most `lines` lines. */
const fitLines = async (line: string, o: LinesStyle) => {
  const lineBox = o.size * o.lineHeight
  const max = o.lines * lineBox + 0.5
  const height = async (candidate: string) =>
    (await probe(candidate, o.width, o.size, o.weight, o.lineHeight, true)).height
  const full = await height(line)
  if (full <= max) return { text: line, cut: false, lines: Math.round(full / lineBox) }
  const best = await longestPrefix(line, async (candidate) => (await height(candidate)) <= max)
  return { text: best, cut: true, lines: o.lines }
}

/** Moves a cut back to the last space, unless that drops more than 40% of the kept text. */
const backOff = (cut: string): string | null => {
  const kept = cut.replace(/…$/u, '').trimEnd()
  const space = kept.lastIndexOf(' ')
  if (space <= 0 || kept.length - space > Math.max(4, kept.length * 0.4)) return null
  return kept.slice(0, space).replace(/[\s,;:·—–-]+$/u, '') + '…'
}

/** One line, cut at a word when it can be. */
export const cutLine = async (
  line: string,
  max: number,
  size: number = T.size.read,
  weight: number = T.weight.regular
): Promise<{ text: string; cut: boolean }> => {
  const fit = await fitOneLine(line, max, size, weight)
  return fit.cut ? { text: backOff(fit.text) ?? fit.text, cut: true } : fit
}

/** Up to `lines` read lines, cut at a word when it can be. */
export const cutLines = async (line: string, width: number, lines: number) => {
  const fit = await fitLines(line, {
    width,
    lines,
    size: T.size.read,
    weight: T.weight.regular,
    lineHeight: T.lineHeight.read
  })
  return fit.cut ? { ...fit, text: backOff(fit.text) ?? fit.text } : fit
}

/** Headline steps, all pad sizes at 2.5x, so no new type size enters the family. */
export const LADDER = {
  /** A lone Pad title: the pad Title 28pt, then the card title size. */
  padTitle: [
    { size: T.size.padTitle, lines: 2 },
    { size: T.size.title, lines: 3 }
  ],
  /** The object of a part card (heading, room): a rank-1 heading 24pt, then the card title size. */
  object: [
    { size: T.size.padHeading, lines: 2 },
    { size: T.size.title, lines: 3 }
  ]
} as const

/** One headline line at the first `object` step, so a token change cannot leave it stale. */
export const HEAD_LINE = Math.round(LADDER.object[0].size * T.lineHeight.title)

interface Headline {
  text: string
  size: number
  lines: number
  cut: boolean
  height: number
}

/**
 * The first step where the whole line fits in `maxHeight`; else the last step, cut at a word.
 * A step gets only the lines that fit in the height left for the headline.
 */
export const fitHead = async (
  line: string,
  steps: readonly { size: number; lines: number }[],
  width: number,
  maxHeight: number
): Promise<Headline> => {
  const usable = steps
    .map((s) => ({
      size: s.size,
      lines: Math.min(s.lines, Math.floor((maxHeight + 0.5) / (s.size * T.lineHeight.title)))
    }))
    .filter((s) => s.lines > 0)
  for (const [i, step] of usable.entries()) {
    const fit = await fitLines(line, {
      width,
      lines: step.lines,
      size: step.size,
      weight: T.weight.bold,
      lineHeight: T.lineHeight.title
    })
    if (fit.cut && i < usable.length - 1) continue
    const text = fit.cut ? (backOff(fit.text) ?? fit.text) : fit.text
    return { ...fit, text, size: step.size, height: fit.lines * step.size * T.lineHeight.title }
  }
  throw new Error('no headline step fits the card body')
}
