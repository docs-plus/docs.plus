import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { computeSection } from '@components/TipTap/extensions/shared'
import { useStore } from '@stores'
import { TIPTAP_NODES, TMsgRow, TRANSACTION_META } from '@types'
import { useCallback } from 'react'

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
      type: TIPTAP_NODES.TEXT_TYPE,
      marks: [
        {
          type: TIPTAP_NODES.HYPERLINK_TYPE,
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
  const editor = useStore((state) => state.settings.editor.instance)
  const { channelId } = useChatroomContext()

  const copyMessageToDocHandler = useCallback(
    (message: TMsgRow) => {
      if (!message || !editor || !channelId) return

      const headingId = channelId
      const { doc, tr } = editor.state

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

      if (headingPos === null || headingChildIndex < 0) return

      const section = computeSection(doc, headingPos, headingLevel, headingChildIndex)

      let insertPosition = headingPos + doc.content.child(headingChildIndex).nodeSize
      let contentOffset = insertPosition
      for (let j = headingChildIndex + 1; j < doc.content.childCount; j++) {
        const child = doc.content.child(j)
        if (contentOffset >= section.to) break
        if (child.type.name === TIPTAP_NODES.HEADING_TYPE) break
        contentOffset += child.nodeSize
        insertPosition = contentOffset
      }

      tr.insert(insertPosition, editor.state.schema.nodeFromJSON(createParagraphNodeJson(message)))
      editor.view.dispatch(tr)

      const insertAndUpdate = () => {
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.setMeta(TRANSACTION_META.COPY_TO_DOC, true)
            return true
          })
          .setTextSelection(insertPosition)
          .scrollIntoView()
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
