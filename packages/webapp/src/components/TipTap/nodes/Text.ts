import { Node } from '@tiptap/core'
import { TIPTAP_NODES } from '@types'

const Text = Node.create({
  name: TIPTAP_NODES.TEXT_TYPE,
  group: 'inline'
})

export default Text
