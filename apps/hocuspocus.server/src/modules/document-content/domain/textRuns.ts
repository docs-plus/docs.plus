import type { JSONContent } from '@tiptap/core'

/** Defensive: y-prosemirror keeps inline nodes as elements, so this only covers a Yjs embed in a text run. */
export const INLINE_NODE_CHAR = '\uFFFC'

export type TextMatch = { ok: true; run: number; offset: number } | { ok: false; count: number }

/** Overlapping hits count: "aa" in "aaa" is two, and the caller must add context. */
export const findUniqueText = (runs: readonly string[], needle: string): TextMatch => {
  let hit = { run: -1, offset: -1 }
  let count = 0
  for (const [run, text] of runs.entries()) {
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
      count += 1
      if (count === 1) hit = { run, offset: at }
    }
  }
  return count === 1 ? { ok: true, ...hit } : { ok: false, count }
}

/**
 * One run per stretch of text between inline nodes, in document order, as the
 * Yjs tree splits a text block. It is the pre-check that avoids loading a cold
 * room; the applier counts again on the live tree, so a disagreement only refuses.
 */
export const jsonTextRuns = (nodes: readonly JSONContent[]): string[] =>
  nodes.flatMap((node) => {
    const children = node.content ?? []
    if (!children.some((child) => child.type === 'text')) return jsonTextRuns(children)
    const runs = ['']
    for (const child of children) {
      if (child.type === 'text') runs[runs.length - 1] += child.text ?? ''
      else runs.push('')
    }
    return runs
  })
