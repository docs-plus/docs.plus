import { useCallback } from 'react'
import { TMsgRow } from '@types'
import { useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'

const createParagraphNodeJson = (message: TMsgRow) => {
  const workspaceId = useStore.getState().settings.workspaceId
  const documentSlug = location.pathname.split('/').pop()
  const channelId = message.channel_id || workspaceId
  const messageId = message.id
  const messageUrl = `/${documentSlug}?act=ch&c_id=${channelId}&m_id=${messageId}`

  const messageOwner = message.user_details?.username || message.user_details?.full_name
  const messageContent = message.content?.trim() || ''
  const messageCreatedAt = new Date(message.created_at)
    .toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    .replace(' ', ' ')

  const newContent = [
    {
      type: 'text',
      marks: [
        {
          type: 'hyperlink',
          attrs: {
            id: null,
            href: messageUrl,
            target: '_blank',
            class: null
          }
        }
      ],
      text: `💬 ${messageCreatedAt} ${messageOwner}: `
    },
    {
      type: TIPTAP_NODES.TEXT_TYPE,
      text: messageContent
    }
  ]

  return {
    type: TIPTAP_NODES.PARAGRAPH_TYPE,
    content: newContent
  }
}

export const useCopyMessageToDocHandler = () => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)
  const { channelId } = useChatroomContext()

  const copyMessageToDocHandler = useCallback(
    (message: TMsgRow) => {
      if (!message || !editor || !channelId) return

      const headingId = channelId

      // Find the heading with matching ID in the document
      const { doc } = editor.state
      let headingPos: number | null = null
      let headingLevel = 1
      let headingNode: any = null

      let secondHeadingPos: number | null = null
      let secondHeadingLevel: number | null = null
      let secondHeadingNode: any = null

      // Traverse the document to find the heading with matching ID
      doc.descendants((node, pos) => {
        // find end of contentWrapper node that after that pos heading node is found
        if (headingPos != null && node.type.name === 'heading' && !secondHeadingPos) {
          secondHeadingPos = pos
          secondHeadingLevel = node.attrs.level
          secondHeadingNode = node
          return false // Stop traversal once found
        }
        if (node.type.name === 'heading' && node.attrs.id === headingId && !headingPos) {
          headingPos = pos
          headingLevel = node.attrs.level
          headingNode = node
        }
      })

      // Calculate position where content should be inserted
      // content should inster at the end of the contentWrapper node before heading node starts
      let insertPosition =
        headingPos !== null && headingNode
          ? headingPos +
            Number(headingNode.content.size) -
            Number(secondHeadingNode?.content.size) -
            2 // End of current heading's content
          : doc.content.size - 2 || 0 // End of document if heading not found

      if (headingLevel === 1) {
        insertPosition = secondHeadingPos !== null ? secondHeadingPos : insertPosition
      }

      if (!insertPosition) {
        insertPosition = headingPos + headingNode?.firstChild?.content.size + 4
      }

      // Insert content at calculated position
      const insertAndUpdate = () => {
        editor
          .chain()
          .focus()
          .insertContentAt(insertPosition, createParagraphNodeJson(message))
          .command(({ tr }) => {
            tr.setMeta('copyToDoc', true)
            return true
          })
          .run()
      }

      insertAndUpdate()
    },
    [editor, channelId]
  )

  return {
    copyMessageToDocHandler
  }
}
