import type { MermaidLimits } from '../types'

const NEXT_STEP = 'Split it into smaller diagrams.'

const count = (n: number): string => n.toLocaleString('en-US')

/**
 * Pele's limit errors carry no kind, so it is read from the wording. Pele also counts
 * edges only up to the limit, so the edge count is "more than", never a number.
 */
export function limitMessage(
  source: string,
  peleMessage: string,
  limits: Required<MermaidLimits>
): string {
  if (/\bsource\b/i.test(peleMessage) || source.length > limits.characters) {
    return `It has ${count(source.length)} characters, and the limit is ${count(limits.characters)}. ${NEXT_STEP}`
  }
  if (/\bedge/i.test(peleMessage)) {
    return `It has more than ${count(limits.edges)} arrows, and the limit is ${count(limits.edges)}. ${NEXT_STEP}`
  }
  return `The drawn diagram would be too big for the page. ${NEXT_STEP}`
}
