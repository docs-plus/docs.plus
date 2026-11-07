import type { Node } from '@takumi-rs/core'

import { cutLine, cutLines, fitHead, footLeftWidth, linesIn, widthOf } from './fit'
import { factChip, read, row, T, titleNode } from './frame'

/**
 * The small line above the title, cut so the part after the pad name stays: "Long pad… › Chat".
 * A long tail (a room name) leaves the pad name half the line, and the line is cut at its end.
 */
export const eyebrowLine = async (name: string, tail: string): Promise<string> => {
  const { size, weight } = T.eyebrow
  const tailW = Math.min(await widthOf(tail, size, weight), T.box.width / 2)
  const head = await cutLine(name, T.box.width - tailW, size, weight)
  return (await cutLine(head.text + tail, T.box.width, size, weight)).text
}

const descNode = (line: string): Node =>
  read(line, {
    size: T.desc.size,
    weight: T.desc.weight,
    lineHeight: T.desc.lineHeight,
    color: T.inkSoft,
    style: { marginTop: T.desc.marginTop, width: T.desc.width }
  })

const EYEBROW_H = T.eyebrow.size * T.eyebrow.lineHeight + T.eyebrow.marginBottom

/**
 * The title and the description under it, in `T.middle` less the eyebrow. Each ladder step
 * keeps room for the description: 2 lines, or 1 under a 3-line title.
 */
export const fitMiddle = async (
  title: string,
  desc: string | null,
  eyebrow: boolean
): Promise<{ title: Node; under: Node[] }> => {
  const room = T.middle - (eyebrow ? EYEBROW_H : 0)
  const cut = (lines: number) => (desc ? cutLines(desc, T.desc.width, lines, T.desc) : null)
  const [one, two] = await Promise.all([cut(1), cut(2)])
  const below = (fit: { lines: number } | null) =>
    fit ? T.desc.marginTop + fit.lines * T.desc.size * T.desc.lineHeight : 0
  const steps = T.headline.steps.flatMap((step) => {
    const lines = Math.min(
      step.lines,
      linesIn(room - below(step.lines >= 3 ? one : two), step.size)
    )
    return lines > 0 ? [{ size: step.size, lines }] : []
  })
  const head = await fitHead(title, steps)
  const under = head.lines >= 3 ? one : two
  return { title: titleNode(head), under: under ? [descNode(under.text)] : [] }
}

/** A chip's drawn width: its text, its padding and its border. */
export const chipWidth = async (line: string) =>
  (await widthOf(line, T.chip.size, T.chip.weight)) + 2 * T.chip.padX + 2 * T.chip.border

/**
 * The leading chips that fit in `room`, each whole: a row clips with no "…". `reserve` is the
 * width kept free after a chip, given how many chips follow it.
 */
export const fitChips = async (
  lines: string[],
  room: number,
  reserve: (left: number) => Promise<number> = async () => 0
): Promise<string[]> => {
  const kept: string[] = []
  let used = 0
  for (const [i, line] of lines.entries()) {
    const add = (kept.length ? T.chip.gap : 0) + (await chipWidth(line))
    if (used + add + (await reserve(lines.length - i - 1)) > room) break
    kept.push(line)
    used += add
  }
  return kept
}

/** The fact chips that fit beside the link, in order; a chip that does not fit is left out whole. */
export const factRow = async (facts: string[], link: string): Promise<Node | undefined> => {
  const kept = await fitChips(facts, await footLeftWidth(link))
  return kept.length ? row(kept.map(factChip), { gap: T.chip.gap }) : undefined
}
