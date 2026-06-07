// Linkify paste mark rule — auto-marks bare URLs found anywhere
// inside pasted text. Distinct from `pasteHandler` (paste-over-selection):
// this fires for plain paste-into-doc.

import { markPasteRule, type PasteRule } from '@tiptap/core'
import { find } from 'linkifyjs'

import type { LinkContext } from './types'

export function createLinkifyPasteRule(ctx: LinkContext): PasteRule {
  return markPasteRule({
    // Detection stays linkify-only (historical behaviour); the gate stack still runs via `forWrite('match')`.
    find: (text) =>
      find(text)
        .filter((link) => link.isLink)
        .flatMap((link) => {
          const [decision] = ctx.urls.forWrite({ kind: 'match', match: link })
          if (!decision) return []
          return [{ text: link.value, index: link.start, data: { href: decision.href } }]
        }),
    type: ctx.type,
    getAttributes: (match) => ({
      href: (match.data as { href: string }).href
    })
  })
}
