import { Node } from '@tiptap/core'
import { TIPTAP_NODES } from '@types'

const Paragraph = Node.create({
  name: TIPTAP_NODES.PARAGRAPH_TYPE,
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'p' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', HTMLAttributes, 0]
  }
})

export default Paragraph
