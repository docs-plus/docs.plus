import { useStore } from '@stores'
import { ResolvedPos } from '@tiptap/pm/model'
import { TIPTAP_NODES } from '@types'
import { useCallback } from 'react'

const useInsertH1Handler = (headingId: string) => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)
  const insertH1Handler = useCallback(() => {
    if (!editor) return

    return
    // find the heading node
    const headingNodeElement = document.querySelector(`.heading[data-id="${headingId}"]`)
    if (!headingNodeElement) return
    // get the heading node pos
    const contentHeadingNodePos = editor?.view.posAtDOM(headingNodeElement as Element, -4, 4)
    const contentHeadingNode = editor?.state.doc.nodeAt(contentHeadingNodePos as number)

    if ((contentHeadingNodePos && contentHeadingNodePos === -1) || !contentHeadingNode) return

    // find parent heading node
    const $pos = editor?.state.doc.resolve(contentHeadingNodePos as number) as ResolvedPos
    let parentHeadingPos: number | null = null
    let parentHeadingNode = null

    // Find the contentwrapper within the current heading
    const currentHeadingNode = $pos.node($pos.depth)

    const insertPos = currentHeadingNode.content.size + $pos.posAtIndex(0, $pos.depth)

    editor?.chain().setTextSelection(insertPos).enter().scrollIntoView().focus().run()

    return

    return

    const emptyParagraphs = Array(5).fill({
      type: TIPTAP_NODES.PARAGRAPH_TYPE
    })

    const jsonNode = {
      type: TIPTAP_NODES.HEADING_TYPE,
      attrs: { level: 1 },
      content: [
        {
          type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
          attrs: { level: 1 }
        },
        {
          type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
          content: emptyParagraphs
        }
      ]
    }

    const selectionPos = parentHeadingNode?.content.size as number

    console.log('selectionPos2222222', {
      selectionPos,
      parentHeadingNode
    })

    editor?.chain().insertContentAt(selectionPos, jsonNode).focus().scrollIntoView().run()
    // editor.commands.insertContent(createHeadingNodeJson('H1', 1))
  }, [editor])
  return insertH1Handler
}

export default useInsertH1Handler
