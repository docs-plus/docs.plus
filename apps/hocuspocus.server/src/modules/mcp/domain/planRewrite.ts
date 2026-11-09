import type { JSONContent } from '@tiptap/core'

import type { KeptBlock, TiptapDocJson } from '../../document-content/types'
import { hasMedia } from './redactMedia'

type DocNodes = TiptapDocJson['content']

export type RewritePlan =
  { ok: true; content: DocNodes; keep: KeptBlock[] } | { ok: false; problem: string }

const PLACEHOLDER_LINE = /^\[(\d+)\]$/

const MISSING_HINT =
  'Write each number alone on a line, such as [3], with a blank line before and after, and do not copy the placeholder after it.'

/** The block numbers a top-level paragraph names, one per line, or null when it is ordinary text. */
const placeholderNumbers = (node: JSONContent): number[] | null => {
  if (node.type !== 'paragraph' || node.content?.length !== 1) return null
  const [only] = node.content
  if (only.type !== 'text' || only.marks?.length || typeof only.text !== 'string') return null
  const numbers = only.text.split('\n').map((line) => PLACEHOLDER_LINE.exec(line.trim())?.[1])
  return numbers.every((number) => number !== undefined) ? numbers.map(Number) : null
}

/**
 * Splits a rewrite into new nodes and the media blocks it keeps. Every media block of
 * `body` must be named exactly once, and before any new heading: a block after one
 * would leave the section. The agent never saw the media, so it can never re-create it.
 * The agent counts blocks from 1; `keep` counts from 0, like every hop position.
 */
export const planRewrite = (
  body: readonly JSONContent[],
  parsed: Readonly<DocNodes>
): RewritePlan => {
  const refuse = (problem: string): RewritePlan => ({ ok: false, problem: `markdown: ${problem}` })
  const content: DocNodes = []
  const keep: KeptBlock[] = []
  let afterHeading = false

  for (const node of parsed) {
    const numbers = placeholderNumbers(node)
    if (!numbers) {
      content.push(node)
      afterHeading ||= node.type === 'heading'
      continue
    }
    for (const block of numbers) {
      if (block < 1 || block > body.length) {
        return refuse(`[${block}] names no block. This section has ${body.length} block(s).`)
      }
      if (!hasMedia([body[block - 1]])) {
        return refuse(
          `[${block}] holds no picture, video or file. Write its text in the Markdown instead.`
        )
      }
      if (keep.some((kept) => kept.block === block - 1)) {
        return refuse(`[${block}] appears more than once. Name each media block once.`)
      }
      if (afterHeading) {
        return refuse(
          `[${block}] stands after a new heading, so it would leave this section. Put new headings after every media block.`
        )
      }
      keep.push({ block: block - 1, at: content.length })
    }
  }

  const missing = body.flatMap((node, index) =>
    hasMedia([node]) && !keep.some((kept) => kept.block === index) ? [index + 1] : []
  )
  if (missing.length > 0) {
    return refuse(
      `block(s) ${missing.join(', ')} hold a picture, video or file, and docs.plus never deletes media for an AI app. Name each one where it should stand. ${MISSING_HINT}`
    )
  }
  return { ok: true, content, keep }
}
