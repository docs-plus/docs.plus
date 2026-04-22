// Paste-over-selection — pasting a single URL with a non-empty
// selection wraps the selection in a hyperlink mark instead of
// replacing it.

import { Plugin, PluginKey } from '@tiptap/pm/state'
import { find } from 'linkifyjs'

import type { LinkContext } from './types'

export function createPasteHandlerInteraction(ctx: LinkContext): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkPasteHandler'),
    props: {
      handlePaste: (view, _event, slice) => {
        const { selection } = view.state
        if (selection.empty) return false

        let textContent = ''
        slice.content.forEach((node) => {
          textContent += node.textContent
        })

        // Historical contract: only fire when the clipboard IS one URL, not when it merely contains one.
        const link = find(textContent).find((item) => item.isLink && item.value === textContent)
        if (!textContent || !link) return false

        const [decision] = ctx.urls.forWrite({ kind: 'match', match: link })
        if (!decision) return false

        return ctx.editor.chain().setHyperlink({ href: decision.href }).run()
      }
    }
  })
}
