import { useCallback } from 'react'
import PubSub from 'pubsub-js'
import { TMessageWithUser as TMsg } from '@api'
import { useStore } from '@stores'
import { CHAT_OPEN } from '@services/eventsHub'
import { TIPTAP_NODES } from '@types'

// For reply in thread feature
const emptyParagraphs = Array(5).fill({
  type: TIPTAP_NODES.PARAGRAPH_TYPE
})

const createHeadingNodeJson = (messageContent: string, headingLevel: number) => {
  return {
    type: TIPTAP_NODES.HEADING_TYPE,
    attrs: { level: Math.min(headingLevel, 10) },
    content: [
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: messageContent }],
        attrs: { level: Math.min(headingLevel, 10) }
      },
      {
        type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
        content: emptyParagraphs
      }
    ]
  }
}

export const useReplyInThread = () => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const handleReplyInThread = useCallback(
    (message: TMsg) => {
      if (!editor || !message) return

      const messageContent = message.content.trim()
      const headingId = message.channel_id

      // Find the heading with matching ID in the document
      const { doc } = editor.state
      let headingPos: number | null = null
      let headingLevel = 1
      let headingNode: any = null

      // Traverse the document to find the heading with matching ID
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.attrs.id === headingId) {
          headingPos = pos
          headingLevel = node.attrs.level
          headingNode = node
          return false // Stop traversal once found
        }
      })

      // Calculate position where content should be inserted
      const insertPosition =
        headingPos !== null && headingNode
          ? headingPos + Number(headingNode.content.size) // End of current heading's content
          : doc.content.size || 0 // End of document if heading not found

      // Insert content at calculated position
      const insertAndUpdate = () => {
        editor
          .chain()
          .focus()
          .insertContentAt(
            Number(insertPosition),
            createHeadingNodeJson(messageContent, headingPos !== null ? headingLevel + 1 : 1),
            { updateSelection: true }
          )
          .command(({ tr }) => {
            tr.setMeta('renderTOC', true)
            return true
          })
          .run()
      }

      // Execute insert and scroll to new position
      insertAndUpdate()

      // After scrollIntoView and open Chatroom
      setTimeout(() => {
        const { doc } = editor.state
        let newHeadingId: string | null = null

        // Search in a range around the insertion point
        const searchStart = Math.max(0, insertPosition - 10)
        const searchEnd = Math.min(doc.content.size, insertPosition + messageContent.length + 100)

        doc.nodesBetween(searchStart, searchEnd, (node, pos) => {
          if (
            node.type.name === 'heading' &&
            node.textContent.trim() === messageContent &&
            node.attrs.id
          ) {
            newHeadingId = node.attrs.id
            return false
          }
        })

        if (newHeadingId) {
          PubSub.publish(CHAT_OPEN, {
            headingId: newHeadingId
          })
        }
      }, 150)
    },
    [editor]
  )

  return {
    handleReplyInThread
  }
}
