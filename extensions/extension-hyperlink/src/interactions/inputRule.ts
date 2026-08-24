import { InputRule } from '@tiptap/core'

import type { LinkContext } from './types'

const MARKDOWN_LINK_RE = /(\[([^\]]+)\]\(([^)]+)\))$/

export function createMarkdownLinkInputRule(ctx: LinkContext): InputRule {
  return new InputRule({
    find: MARKDOWN_LINK_RE,
    handler: ({ state, range, match }) => {
      const [, , linkText, url] = match
      const { tr } = state
      const start = range.from
      const end = range.to

      // Gate fails → leave the markdown literal as typed (so `[x](javascript:…)` doesn't silently disappear).
      const [decision] = ctx.urls.forWrite({ kind: 'href', href: url })
      if (!decision) return

      // `nodeAt(start)`, not `resolve(start).marks()` — the latter reads the node
      // BEFORE the position and misses a mark toggled on at the `[`.
      const carried = state.doc.nodeAt(start)?.marks.filter((m) => m.type !== ctx.type) ?? []
      tr.replaceWith(start, end, state.schema.text(linkText, carried))
      tr.addMark(start, start + linkText.length, ctx.type.create({ href: decision.href }))
    }
  })
}
