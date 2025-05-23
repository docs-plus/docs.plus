import React, { useCallback } from 'react'
import { deleteMessage, TMessageWithUser as TMsg } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useChannel } from '../../../context/ChannelProvider'
import ENUMS from '@components/TipTap/enums'
import * as toast from '@components/toast'
import { IoCheckmarkDoneSharp, IoCheckmarkSharp } from 'react-icons/io5'
import {
  MdOutlineComment,
  MdDeleteOutline,
  MdOutlineEmojiEmotions,
  MdMoreVert,
  MdOutlineEdit
} from 'react-icons/md'
import { ReplyMD } from '@components/icons/Icons'
import { CHAT_OPEN } from '@services/eventsHub'

// For reply in thread feature
const emptyParagraphs = Array(5).fill({
  type: ENUMS.NODES.PARAGRAPH_TYPE
})

const createJsonNode = (messageContent: string, headingLevel: number) => {
  return {
    type: ENUMS.NODES.HEADING_TYPE,
    attrs: { level: Math.min(headingLevel, 10) },
    content: [
      {
        type: ENUMS.NODES.CONTENT_HEADING_TYPE,
        content: [{ type: ENUMS.NODES.TEXT_TYPE, text: messageContent }],
        attrs: { level: Math.min(headingLevel, 10) }
      },
      {
        type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
        content: emptyParagraphs
      }
    ]
  }
}

type MessageActionsProps = {
  className?: string
  message: TMsg
}

export const MessageActions = ({ className, message }: MessageActionsProps) => {
  const { channelId } = useChannel()
  const user = useAuthStore((state) => state.profile)
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const handleEdit = useCallback(() => {
    if (!message) return
    setEditMessageMemory(channelId, message)
  }, [channelId, message, setEditMessageMemory])

  const handleReply = useCallback(() => {
    setReplyMessageMemory(message.channel_id, message)
    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [message, setReplyMessageMemory])

  const openEmojiPicker = useCallback((event: React.MouseEvent, message: TMsg) => {
    const customEvent = new CustomEvent('toggelEmojiPicker', {
      detail: {
        clickEvent: event,
        message,
        type: 'react2Message'
      }
    })
    document.dispatchEvent(customEvent)
  }, [])

  const handleDeleteMessage = useCallback(async () => {
    if (!message) return
    const { error } = await deleteMessage(message.channel_id, message.id)
    if (error) return toast.Error('Message not deleted')

    toast.Success('Message deleted')
  }, [message])

  const handleReplyInThread = useCallback(() => {
    if (!editor) return

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
          createJsonNode(messageContent, headingPos !== null ? headingLevel + 1 : 1),
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
  }, [message, editor])

  return (
    <div className={`join bg-base-300 rounded-md shadow-xs ${className}`}>
      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-top"
        data-tip={message.readed_at ? 'message read' : 'message sent'}>
        <div
          className={`${message.id !== 'fake_id' ? 'block' : 'hidden'} invisible top-0 left-0 group-hover/msgcard:visible`}>
          {!message.readed_at ? <IoCheckmarkSharp className="text-base-content size-4" /> : null}
          {message.readed_at ? <IoCheckmarkDoneSharp className="text-base-content size-4" /> : null}
        </div>
      </button>
      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Add Reaction"
        onClick={(e) => openEmojiPicker(e, message)}>
        <MdOutlineEmojiEmotions size={20} className="text-gray-600" />
      </button>

      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Reply to Message"
        onClick={handleReply}>
        <ReplyMD size={20} className="text-gray-600" />
      </button>

      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Reply in thread"
        onClick={handleReplyInThread}>
        <MdOutlineComment size={20} className="text-docsy" />
      </button>

      {user && message.user_id === user.id && (
        <div className="dropdown dropdown-end">
          <button tabIndex={0} role="button" className="btn btn-sm btn-square join-item btn-ghost">
            <MdMoreVert size={20} className="text-gray-600" />
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 !p-2 shadow-sm">
            <li>
              <a className="flex items-center gap-2" onClick={handleEdit}>
                <MdOutlineEdit size={20} />
                Edit Message
              </a>
            </li>
            <li>
              <a className="text-error flex items-center gap-2" onClick={handleDeleteMessage}>
                <MdDeleteOutline size={20} />
                Delete Message
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
