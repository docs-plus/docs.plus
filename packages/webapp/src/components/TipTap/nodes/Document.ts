import { Node } from '@tiptap/core'
import { TIPTAP_NODES } from '@types'

const Document = Node.create({
  name: TIPTAP_NODES.DOC_TYPE,
  topNode: true,
  content: 'heading+'
})

export default Document
