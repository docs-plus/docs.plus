import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Editor } from '@tiptap/react'
import { TIPTAP_NODES } from '@types'

import deleteSelectedRange from '../deleteSelectedRange'

/**
 * Creates a plugin for handling text input when there's a range selection
 * @param editor - The TipTap editor instance
 * @returns ProseMirror plugin
 */
export function createRangeSelectionPlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('handleRangeSelection'),
    props: {
      handleTextInput: () => {
        const { $anchor, $head } = editor.state.selection

        // we need detect the selection
        if ($anchor?.pos === $head?.pos) return false

        const isAnchorInContentHeading =
          $anchor.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE
        const isHeadInContentHeading = $head.parent.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE

        // TODO: Handle this case later
        // if the $ancher parent is contentheading then return false
        if (isAnchorInContentHeading) {
          console.info(
            '[Heading][RangeSelection]: contentHeading detected, we do not need to handle this'
          )
          // if both $anchor and $head parents are content headings, do nothing
          return isHeadInContentHeading ? false : true
        }

        console.info('[Heading] Range selection delete')
        // if user select a range of content, then hit any key, remove the selected content
        return deleteSelectedRange(editor)
      }
    }
  })
}
