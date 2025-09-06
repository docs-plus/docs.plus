import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { Editor } from '@tiptap/core'
import { imageClickHandler, imageKeyDownHandler, isImageUrl } from './helper'
import type {
  HyperImagePluginOptions,
  ImageClickHandlerOptions,
  ImageKeyDownHandlerOptions
} from '../../types'

export const HyperImagePlugin = (editor: Editor, options: HyperImagePluginOptions) => {
  const handleImageClick = (view: EditorView, event: MouseEvent | TouchEvent) => {
    const clickOptions: ImageClickHandlerOptions = {
      editor,
      toolbar: options.toolbar
    }

    return imageClickHandler(view, event, clickOptions)
  }

  const handleKeyDown = (view: EditorView, event: KeyboardEvent) => {
    const keyDownOptions: ImageKeyDownHandlerOptions = {
      nodeName: options.nodeName
    }

    return imageKeyDownHandler(view, event, keyDownOptions)
  }

  return new Plugin({
    key: new PluginKey('HyperImagePlugin'),
    props: {
      handleDOMEvents: {
        click: handleImageClick,
        touchend: handleImageClick,
        keydown: handleKeyDown
      }
    }
  })
}

export const HyperImagePastePlugin = (editor: Editor, options: { nodeName: string }) => {
  return new Plugin({
    key: new PluginKey('ImagePasteHandler'),
    props: {
      handlePaste: (view, event, slice) => {
        // First check for actual image files in clipboard
        if (event.clipboardData?.files?.length) {
          const files = Array.from(event.clipboardData.files)
          const imageFile = files.find((file) => file.type.startsWith('image/'))

          if (imageFile) {
            event.preventDefault()

            // Delegate to existing upload system
            triggerFileUpload(imageFile, editor)
            return true
          }
        }

        // Check for image data in clipboard items (for screenshots)
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

        // Fallback: Check if it's a single text node with an image URL
        const content = slice.content
        if (content.childCount === 1) {
          const firstChild = content.firstChild

          // Check if it's a paragraph with just text
          if (firstChild?.type.name === 'paragraph' && firstChild.childCount === 1) {
            const textNode = firstChild.firstChild

            if (textNode?.type.name === 'text' && textNode.text) {
              const text = textNode.text.trim()

              // Check if the text is an image URL
              if (isImageUrl(text)) {
                // Prevent default paste behavior
                event.preventDefault()

                // Create an image node instead
                const imageNode = view.state.schema.nodes[options.nodeName].create({
                  src: text,
                  alt: 'Pasted Image'
                })

                // Insert the image node
                const tr = view.state.tr.replaceSelectionWith(imageNode)
                view.dispatch(tr)

                return true // Handled
              }
            }
          }
        }

        return false // Not handled, let default paste behavior continue
      }
    }
  })
}

// Helper function to trigger the existing upload system
const triggerFileUpload = (file: File, editor: Editor) => {
  // Create a custom event to communicate with the upload system
  const uploadEvent = new CustomEvent('editorFileUpload', {
    detail: { file, editor }
  })

  // Dispatch to document for global handling
  document.dispatchEvent(uploadEvent)
}
