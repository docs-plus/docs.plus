import { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { isImageUrl } from './helper'

export const HyperImagePastePlugin = (
  editor: Editor,
  options: { nodeName: string; allowBase64: boolean }
): Plugin => {
  return new Plugin({
    key: new PluginKey('ImagePasteHandler'),
    props: {
      handlePaste: (view, event, slice) => {
        if (event.clipboardData?.files?.length) {
          const imageFiles = Array.from(event.clipboardData.files).filter((file) =>
            file.type.startsWith('image/')
          )

          if (imageFiles.length > 0) {
            event.preventDefault()
            triggerFileUpload(imageFiles, editor)
            // Claim the paste even though the host inserts: a screenshot populates
            // both `files` and `items`, and the branch below would fire again.
            return true
          }
        }

        if (event.clipboardData?.items?.length) {
          const imageFiles = Array.from(event.clipboardData.items)
            .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null)

          if (imageFiles.length > 0) {
            event.preventDefault()
            triggerFileUpload(imageFiles, editor)
            return true
          }
        }

        const content = slice.content
        if (content.childCount === 1) {
          const firstChild = content.firstChild

          if (firstChild?.type.name === 'paragraph' && firstChild.childCount === 1) {
            const textNode = firstChild.firstChild

            if (textNode?.type.name === 'text' && textNode.text) {
              const text = textNode.text.trim()

              // Mirror parseHTML's allowBase64 gate: pasted data: URLs are rejected too.
              if (!options.allowBase64 && text.startsWith('data:')) return false

              if (isImageUrl(text)) {
                event.preventDefault()

                const imageNode = view.state.schema.nodes[options.nodeName].create({
                  src: text,
                  alt: 'Pasted Image'
                })

                const tr = view.state.tr.replaceSelectionWith(imageNode)
                view.dispatch(tr)

                return true
              }
            }
          }
        }

        return false
      }
    }
  })
}

const triggerFileUpload = (files: File[], editor: Editor) => {
  document.dispatchEvent(new CustomEvent('editorFileUpload', { detail: { files, editor } }))
}
