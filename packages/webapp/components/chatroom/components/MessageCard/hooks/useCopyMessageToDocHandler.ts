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
      const { doc, tr } = editor.state
      let headingPos: number | null = null
      let headingLevel = 1
      let headingNode: any = null

      // Traverse the document to find the heading with matching ID
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.attrs.id === headingId && !headingPos) {
          headingPos = pos
          headingLevel = node.attrs.level
          headingNode = node
          return false
        }
      })

      const headingContentNode = headingNode?.firstChild
      const contentWrapperNode = headingNode?.lastChild

      let foundFirstHeading = false
      let firstHeadingOffset = contentWrapperNode.content.size

      // find a first heading in the contentWrapper, if it deos not exsits,
      // the end of the contentWrapper is the end pos
      contentWrapperNode.content.forEach((child: any, offset: number) => {
        if (child.type.name === 'heading' && !foundFirstHeading) {
          foundFirstHeading = true
          firstHeadingOffset = offset
          return true
        }
      })

      const insertPosition = headingPos + headingContentNode.nodeSize + 2 + firstHeadingOffset

      tr.insert(insertPosition, editor.state.schema.nodeFromJSON(createParagraphNodeJson(message)))
      editor.view.dispatch(tr)

      // Insert content at calculated position
      const insertAndUpdate = () => {
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.setMeta('copyToDoc', true)
            return true
          })
          .setTextSelection(insertPosition)
          .scrollIntoView()
          .run()
      }

      insertAndUpdate()

      return
    },
    [editor, channelId]
  )

  return {
    copyMessageToDocHandler
  }
}
