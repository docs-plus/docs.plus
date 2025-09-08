import { useStore } from '@stores'
import { ResolvedPos } from '@tiptap/pm/model'

type Props = {
  headingId: string
}

export const DeleteHeadingDialogContnet = ({ headingId }: Props) => {
  const {
    closeDialog,
    settings: {
      editor: { instance: editor }
    }
  } = useStore()

  const handleDeleteConfirm = async () => {
    closeDialog()
    // find the heading node
    const headingNodeElement = document.querySelector(`.heading[data-id="${headingId}"]`)
    if (!headingNodeElement) return
    // get the heading node pos
    const contentHeadingNodePos = editor?.view.posAtDOM(headingNodeElement, -4, 4)
    const contentHeadingNode = editor?.state.doc.nodeAt(contentHeadingNodePos as number)

    if ((contentHeadingNodePos && contentHeadingNodePos === -1) || !contentHeadingNode) return

    // find parent heading node
    const $pos = editor?.state.doc.resolve(contentHeadingNodePos as number) as ResolvedPos
    let parentHeadingPos: number | null = null
    let parentHeadingNode = null

    // traverse up the document tree to find a parent with type "heading"
    for (let depth = $pos.depth; depth > 0; depth--) {
      const node = $pos.node(depth)
      if (node.type.name === 'heading') {
        parentHeadingPos = $pos.start(depth)
        parentHeadingNode = node
        break
      }
    }

    // delete the entire parent heading node with all its content
    if (parentHeadingPos !== null && parentHeadingNode) {
      const tr = editor?.state.tr
      const startPos = parentHeadingPos - 4 // 4 is the offset of the heading node
      const endPos = parentHeadingPos + parentHeadingNode.nodeSize

      tr?.delete(startPos, endPos)
      if (tr) {
        editor?.view.dispatch(tr)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 pr-3 pb-3">
      <div>
        <p className="text-gray-600">Do you want to delete this heading section?</p>
      </div>
      <div className="flex justify-end gap-4">
        <button className="btn btn-ghost" onClick={closeDialog}>
          Cancel
        </button>
        <button className="btn btn-ghost" onClick={handleDeleteConfirm}>
          Delete
        </button>
      </div>
    </div>
  )
}
