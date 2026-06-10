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
          const files = Array.from(event.clipboardData.files)
          const imageFile = files.find((file) => file.type.startsWith('image/'))

          if (imageFile) {
            event.preventDefault()
            triggerFileUpload(imageFile, editor)
            return true
          }
        }

        if (event.clipboardData?.items?.length) {
          const items = Array.from(event.clipboardData.items)
          const imageItem = items.find((item) => item.type.startsWith('image/'))

          if (imageItem) {
            event.preventDefault()

            const file = imageItem.getAsFile()
            if (file) {
              triggerFileUpload(file, editor)
              return true
            }
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

const triggerFileUpload = (file: File, editor: Editor) => {
  const uploadEvent = new CustomEvent('editorFileUpload', {
    detail: { file, editor }
  })

  document.dispatchEvent(uploadEvent)
}
