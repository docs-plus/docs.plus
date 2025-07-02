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
        // Get the pasted content
        const content = slice.content

        // Check if it's a single text node with an image URL
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
