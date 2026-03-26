import { computeSection } from '@components/TipTap/extensions/shared'
import { CHAT_OPEN } from '@services/eventsHub'
import { useStore } from '@stores'
import { TIPTAP_NODES, TMsgRow, TRANSACTION_META } from '@types'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'

const emptyParagraphs = Array(5).fill({
  type: TIPTAP_NODES.PARAGRAPH_TYPE
})

const createHeadingNodeJson = (messageContent: string, headingLevel: number) => {
  return [
    {
      type: TIPTAP_NODES.HEADING_TYPE,
      attrs: { level: Math.min(headingLevel, 6) },
      content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: messageContent }]
    },
    ...emptyParagraphs
  ]
}

export const useReplyInThreadHandler = () => {
  const editor = useStore((state) => state.settings.editor.instance)

  const replyInThreadHandler = useCallback(
    (message: TMsgRow) => {
      if (!editor || !message) return

      const messageContent = message.content?.trim() || ''
      const headingId = message.channel_id

      const { doc } = editor.state
      let headingPos: number | null = null
      let headingLevel = 1
      let headingChildIndex = -1
      let offset = 0

      for (let i = 0; i < doc.content.childCount; i++) {
        const child = doc.content.child(i)
        const pos = offset
        offset += child.nodeSize

        if (
          child.type.name === TIPTAP_NODES.HEADING_TYPE &&
          (child.attrs['toc-id'] as string) === headingId
        ) {
          headingPos = pos
          headingLevel = child.attrs.level as number
          headingChildIndex = i
          break
        }
      }

      let insertPosition: number
      if (headingPos !== null && headingChildIndex >= 0) {
        const section = computeSection(doc, headingPos, headingLevel, headingChildIndex)
        insertPosition = section.to
      } else {
        insertPosition = doc.content.size || 0
      }

      const newNodes = createHeadingNodeJson(
        messageContent,
        headingPos !== null ? headingLevel + 1 : 1
      )

      const insertAndUpdate = () => {
        editor
          .chain()
          .focus()
          .insertContentAt(Number(insertPosition), newNodes, { updateSelection: true })
          .command(({ tr }) => {
            tr.setMeta(TRANSACTION_META.RENDER_TOC, true)
            return true
          })
          .run()
      }

      insertAndUpdate()

      setTimeout(() => {
        const { doc } = editor.state
        let newHeadingId: string | null = null

        const searchStart = Math.max(0, insertPosition - 10)
        const searchEnd = Math.min(doc.content.size, insertPosition + messageContent.length + 100)

        doc.nodesBetween(searchStart, searchEnd, (node: any) => {
          if (
            node.type.name === TIPTAP_NODES.HEADING_TYPE &&
            node.textContent.trim() === messageContent &&
            node.attrs['toc-id']
          ) {
            newHeadingId = node.attrs['toc-id']
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
    replyInThreadHandler
  }
}
