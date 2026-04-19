import { Editor } from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { find } from 'linkifyjs'

import { normalizeLinkifyHref } from '../utils/normalizeHref'

type PasteHandlerOptions = {
  editor: Editor
  type: MarkType
  validate?: (url: string) => boolean
}

export default function pasteHandlerPlugin(options: PasteHandlerOptions): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkPasteHandler'),
    props: {
      handlePaste: (view, event, slice) => {
        const { state } = view
        const { selection } = state
        const { empty } = selection

        if (empty) {
          return false
        }

        let textContent = ''

        slice.content.forEach((node) => {
          textContent += node.textContent
        })

        const link = find(textContent).find((item) => item.isLink && item.value === textContent)

        if (!textContent || !link) {
          return false
        }

        if (options.validate && !options.validate(link.href)) {
          return false
        }

        options.editor.commands.setMark(options.type, {
          href: normalizeLinkifyHref(link)
        })

        return true
      }
    }
  })
}
