import type { Editor } from '@tiptap/core'

/** Walk the doc for a media node whose `keyId` attr matches. */
export function findMediaNodePosByKeyId(editor: Editor, keyId: string): number | null {
  let found: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.keyId === keyId) {
      found = pos
      return false
    }
  })
  return found
}
