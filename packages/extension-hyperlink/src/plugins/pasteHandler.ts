import { Editor } from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { find } from 'linkifyjs'

import { DEFAULT_PROTOCOL, normalizeLinkifyHref } from '../utils/normalizeHref'

type PasteHandlerOptions = {
  editor: Editor
  type: MarkType
  validate?: (url: string) => boolean
  /** Per-link autolink veto. Mirrors the extension option so paste-over-selection honors the same policy as autolink + markPasteRule. */
  shouldAutoLink?: (uri: string) => boolean
  /** Bare-domain promotion target for linkify URL matches. */
  defaultProtocol?: string
}

export default function pasteHandlerPlugin(options: PasteHandlerOptions): Plugin {
  const defaultProtocol = options.defaultProtocol ?? DEFAULT_PROTOCOL
  return new Plugin({
    key: new PluginKey('hyperlinkPasteHandler'),
    props: {
      handlePaste: (view, event, slice) => {
        const { selection } = view.state
        if (selection.empty) return false

        let textContent = ''
        slice.content.forEach((node) => {
          textContent += node.textContent
        })

        const link = find(textContent).find((item) => item.isLink && item.value === textContent)
        if (!textContent || !link) return false

        const href = normalizeLinkifyHref(link, defaultProtocol)
        if (options.validate && !options.validate(link.href)) return false
        // Parity with `markPasteRule` and `autolinkPlugin` — `shouldAutoLink`
        // is a per-URI veto for *automatic* linkification; without this
        // check, paste-over-selection would silently bypass the user's
        // policy that the other autolink surfaces honor.
        if (options.shouldAutoLink && !options.shouldAutoLink(href)) return false

        // Delegate to the canonical command: it normalizes against
        // `defaultProtocol`, runs the composed XSS + `isAllowedUri`
        // gate, and stamps `PREVENT_AUTOLINK_META`. Returns `false`
        // when the gate rejects, in which case we let ProseMirror
        // fall through to its default paste behaviour.
        return options.editor.chain().setHyperlink({ href }).run()
      }
    }
  })
}
