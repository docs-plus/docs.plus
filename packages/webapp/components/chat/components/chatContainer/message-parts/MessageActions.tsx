import React, { useCallback, useEffect, useState } from 'react'
import {
  deleteMessage,
  toggleMessageBookmark,
  TMessageWithUser as TMsg,
  getChannelMembersByLastReadUpdate,
  ChannelMemberReadUpdate
} from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useApi } from '@hooks/useApi'
import { useChannel } from '../../../context/ChannelProvider'
import ENUMS from '@components/TipTap/enums'
import * as toast from '@components/toast'
import AvatarStack from '@components/AvatarStack'
import { IoCheckmarkDoneSharp, IoCheckmarkSharp } from 'react-icons/io5'
import {
  MdOutlineComment,
  MdDeleteOutline,
  MdOutlineEmojiEmotions,
  MdMoreVert,
  MdOutlineEdit,
  MdOutlineFileOpen,
  MdBookmarkRemove,
  MdOutlineBookmarkAdd
} from 'react-icons/md'
import { ReplyMD } from '@components/icons/Icons'
import { CHAT_OPEN } from '@services/eventsHub'
import Dropdown, { useDropdown } from '@components/ui/Dropdown'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
// For reply in thread feature
const emptyParagraphs = Array(5).fill({
  type: ENUMS.NODES.PARAGRAPH_TYPE
})

const createHeadingNodeJson = (messageContent: string, headingLevel: number) => {
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

const createParagraphNodeJson = (message: TMsg) => {
  const workspaceId = useStore.getState().settings.workspaceId
  const documentSlug = location.pathname.split('/').pop()
  const channelId = message.channel_id || workspaceId
  const messageId = message.id
  const messageUrl = `/${documentSlug}?act=ch&c_id=${channelId}&m_id=${messageId}`

  const messageOwner = message.user_details.username || message.user_details.fullname
  const messageContent = message.content.trim()
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
      type: ENUMS.NODES.TEXT_TYPE,
      text: messageContent
    }
  ]

  return {
    type: ENUMS.NODES.PARAGRAPH_TYPE,
    content: newContent
  }
}

type MessageActionsProps = {
  className?: string
  message: TMsg
}

const DropdownContent = ({ message }: { message: TMsg }) => {
  const { isOpen } = useDropdown()
  const user = useAuthStore((state) => state.profile)
  const { channelId } = useChannel()
  const [readUsers, setReadUsers] = useState<ChannelMemberReadUpdate[]>([])
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const { request: fetchReadUsers, loading: readUsersLoading } = useApi(
    getChannelMembersByLastReadUpdate,
    [message.channel_id, message.created_at],
    false
  )

  useEffect(() => {
    const fetchData = async () => {
      if (isOpen) {
        const { data } = await fetchReadUsers(channelId, message.created_at)
        setReadUsers(data as ChannelMemberReadUpdate[])
        console.log({
          readUsers
        })
      }
    }

    fetchData()
  }, [isOpen])

  const handleCopyToDoc = useCallback(() => {
    if (!message) return
    if (!editor) return

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
    let insertPosition =
      headingPos !== null && headingNode
        ? headingPos + Number(headingNode.content.size) // End of current heading's content
        : doc.content.size - 2 || 0 // End of document if heading not found

    if (headingLevel === 1) {
      insertPosition = secondHeadingPos !== null ? secondHeadingPos : insertPosition
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
  }, [message, editor])

  const handleEdit = useCallback(() => {
    if (!message) return
    setEditMessageMemory(channelId, message)
  }, [channelId, message, setEditMessageMemory])

  const handleDeleteMessage = useCallback(async () => {
    if (!message) return
    const { error } = await deleteMessage(message.channel_id, message.id)
    if (error) return toast.Error('Message not deleted')

    toast.Success('Message deleted')
  }, [message])

  return (
    <ul className="menu bg-base-100 w-52 !p-1">
      <li>
        <a className="flex items-center gap-2" onClick={handleCopyToDoc}>
          <MdOutlineFileOpen size={20} />
          Copy to doc
        </a>
      </li>
      {user && message.user_id === user.id && (
        <>
          <li>
            <a className="flex items-center gap-2" onClick={handleEdit}>
              <MdOutlineEdit size={20} />
              Edit Message
            </a>
          </li>
          <li className="border-gray-300">
            <a className="text-error flex items-center gap-2" onClick={handleDeleteMessage}>
              <MdDeleteOutline size={20} />
              Delete Message
            </a>
          </li>
        </>
      )}

      {message.readed_at &&
        (readUsersLoading ? (
          <li className="menu-disabled flex flex-row items-center gap-2 border-t border-gray-300">
            <div className="skeleton ml-2 h-4 w-4 rounded-full p-0"></div>
            <div className="skeleton h-4 w-10 rounded-full"></div>
            <AvatarStackLoader size={7} repeat={4} className="ml-auto !-space-x-6 pr-1" />
          </li>
        ) : (
          <li className="menu-disabled !my-1 border-t border-gray-300">
            <div className="flex items-center gap-2 py-0 pt-2">
              <span className="text-xs text-gray-500">
                {!message.readed_at ? (
                  <IoCheckmarkSharp className="text-base-content size-4 text-gray-400" />
                ) : (
                  <span className="flex items-center gap-3">
                    <IoCheckmarkDoneSharp className="text-base-content size-4 text-gray-400" />
                    {readUsers.length} seen
                  </span>
                )}
              </span>

              <AvatarStack
                className="ml-auto !-space-x-4"
                users={(readUsers as ChannelMemberReadUpdate[]).map((user) => ({
                  id: user.id,
                  username: user.username,
                  full_name: user.full_name,
                  avatar_url: user.avatar_url,
                  avatar_updated_at: user.avatar_updated_at
                }))}
                size={8}
                maxDisplay={5}
              />
            </div>
          </li>
        ))}
    </ul>
  )
}

export const MessageActions = ({ className, message }: MessageActionsProps) => {
  const { channelId } = useChannel()
  const user = useAuthStore((state) => state.profile)
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const setOrUpdateMessage = useChatStore((state) => state.setOrUpdateMessage)

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const { request: toggleBookmark, loading: bookmarkLoading } = useApi(
    toggleMessageBookmark,
    null,
    false
  )

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
  }, [message, editor])

  const handleBookmarkMessage = useCallback(async () => {
    if (!message) return

    const { error, data } = await toggleBookmark({ messageId: message.id })

    if (error) {
      toast.Error('Failed to toggle bookmark')
      return
    }

    if (data) {
      setOrUpdateMessage(message.channel_id, message.id, {
        // @ts-ignore
        bookmark_id: data.action === 'added' ? data.bookmark_id : null,
        // @ts-ignore
        is_bookmarked: data.action === 'added' ? true : false
      })
    }
    // @ts-ignore
    toast.Success(data?.action === 'added' ? 'Bookmark added' : 'Bookmark removed')
  }, [message, toggleBookmark])

  return (
    <div className={`join bg-base-300 rounded-md shadow-xs ${className}`}>
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
        data-tip="Bookmark Message"
        disabled={bookmarkLoading}
        onClick={handleBookmarkMessage}>
        {bookmarkLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        ) : message.is_bookmarked || message.bookmark_id ? (
          <MdBookmarkRemove size={20} className="text-blue-600" />
        ) : (
          <MdOutlineBookmarkAdd size={20} className="text-gray-600" />
        )}
      </button>

      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Reply in thread"
        onClick={handleReplyInThread}>
        <MdOutlineComment size={20} className="text-docsy" />
      </button>

      <Dropdown
        button={
          <button className="btn btn-sm btn-square join-item btn-ghost">
            <MdMoreVert size={20} className="text-gray-600" />
          </button>
        }
        className="dropdown-bottom dropdown-end"
        contentClassName="dropdown-content bg-base-100 overflow-hidden rounded-box z-[1]  border border-gray-300 shadow-md">
        <DropdownContent message={message} />
      </Dropdown>
    </div>
  )
}
