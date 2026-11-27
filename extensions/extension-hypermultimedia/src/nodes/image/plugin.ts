import { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { isSafeMediaSrc } from '../../utils/mediaUrl'
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

        const firstChild = slice.content.childCount === 1 ? slice.content.firstChild : null
        const textNode =
          firstChild?.type.name === 'paragraph' && firstChild.childCount === 1
            ? firstChild.firstChild
            : null
        const text = textNode?.type.name === 'text' ? textNode.text?.trim() : undefined
        // Mirror parseHTML's scheme + allowBase64 gate: reject data:image/svg+xml,
        // blob:, and (when allowBase64 is false) inline data: URLs.
        if (
          !text ||
          !isSafeMediaSrc(text, { allowInlineImage: options.allowBase64 }) ||
          !isImageUrl(text)
        ) {
          return false
        }

        event.preventDefault()

        const imageNode = view.state.schema.nodes[options.nodeName].create({
          src: text,
          alt: 'Pasted Image'
        })

        view.dispatch(view.state.tr.replaceSelectionWith(imageNode))

        return true
      }
    }
  })
}

const triggerFileUpload = (files: File[], editor: Editor) => {
  document.dispatchEvent(new CustomEvent('editorFileUpload', { detail: { files, editor } }))
}
