import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Slice, Fragment } from '@tiptap/pm/model'
import { Editor } from '@tiptap/react'
import { getSelectionBlocks } from '../helper'
import clipboardPast from '../clipboardPast'
import deleteSelectedRange from '../deleteSelectedRange'

/**
 * Creates a plugin for handling copy and paste operations with custom transformations
 * @param editor - The TipTap editor instance
 * @returns ProseMirror plugin
 */
export function createCopyPastePlugin(editor: Editor): Plugin {
  let domeEvent: string

  return new Plugin({
    key: new PluginKey('copy&pasteHeading'),
    props: {
      handleDOMEvents: {
        cut: () => {
          domeEvent = 'cut'
          return false
        },
        copy: () => {
          domeEvent = 'copy'
        }
      },
      // INFO: Div turn confuses the schema service;
      // INFO: if there is a div in the clipboard, the docsplus schema will not serialize as a must.
      transformPastedHTML: (html: string) => html.replace(/div/g, 'span'),
      transformPasted: (slice: Slice) => clipboardPast(slice, editor),
      transformCopied: () => {
        // Can be used to transform copied or cut content before it is serialized to the clipboard.
        const { selection, doc } = editor.state
        const { from, to } = selection

        // TODO: this function retrive blocks level from the selection, I need to block characters level from the selection
        const contentWrapper = getSelectionBlocks(doc.cut(from, to), from, to, true, true)

        console.log('transformCopied', {
          contentWrapper,
          domeEvent
        })

        if (domeEvent === 'cut') {
          // remove selection from the editor
          deleteSelectedRange(editor)
        }

        // convert Json Block to Node Block
        const serializeSelection = contentWrapper.map((x) => editor.state.schema.nodeFromJSON(x))

        // convert Node Block to Fragment
        const fragmentArray = Fragment.fromArray(serializeSelection)

        console.log('serializeSelection', {
          serializeSelection: fragmentArray
        })

        // convert Fragment to Slice and save it to clipboard
        return Slice.maxOpen(fragmentArray)
      }
    }
  })
}
