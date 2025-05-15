// TODO: Refactor neeededddddd
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { deleteMessage, TMessageWithUser } from '@api'
import { MessageContextMenu } from '../../MessageContextMenu'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore, useChatStore, useStore } from '@stores'
import MessageFooter from './MessageFooter'
import MessageContent from './MessageContent'
import { isOnlyEmoji } from '@utils/index'
import { useChannel } from '../../context/ChannelProvider'
import { MsgComment } from './MsgComment'
import { MsgReplyTo } from './MsgReplyTo'
import { IoCheckmarkDoneSharp } from 'react-icons/io5'
import { IoTimeOutline } from 'react-icons/io5'
import { IoCheckmarkSharp } from 'react-icons/io5'
import MessageReaction from '@components/chat/MessageReaction'
import {
  BsReplyFill,
  BsForwardFill,
  BsFillPinFill,
  BsFillTrashFill,
  BsFillPinAngleFill
} from 'react-icons/bs'
import { RiPencilFill } from 'react-icons/ri'
import { MdOutlineComment } from 'react-icons/md'
import { MdMoreVert } from 'react-icons/md'
import { MdOutlineEdit } from 'react-icons/md'
import ENUMS from '@components/TipTap/enums'

import { MdOutlineEmojiEmotions, MdOutlineBookmarkBorder, MdOutlineMoreVert } from 'react-icons/md'
import { IoChatbubbleOutline, IoShareOutline } from 'react-icons/io5'
import { toast } from 'react-hot-toast'
import { MdDeleteOutline } from 'react-icons/md'
import { ReplyMD } from '@components/icons/Icons'
import { CgMailReply } from 'react-icons/cg'
import { TbPinned } from 'react-icons/tb'
import ReactionsCard from './ReactionsCard'

// Helper function to format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString(navigator.language, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  })
}

const ReplyIndicator = ({ count }: { count: number | undefined }) =>
  count ? (
    <div className="flex items-center">
      <CgMailReply size={16} />
      <span className="text-xs">{count}</span>
    </div>
  ) : null

const EditedIndicator = ({ isEdited }: { isEdited?: boolean }) =>
  isEdited ? <span className="text-base-content text-opacity-50 text-xs">edited</span> : null

const CardIndicators = ({ data }: { data: TMessageWithUser }) => {
  const countRepliedMessages = data.metadata?.replied?.length
  return (
    <div className={`chat-footer text-base-content mt-1 flex items-center justify-end gap-2 px-2`}>
      <div className="flex items-center gap-2">
        <ReplyIndicator count={countRepliedMessages} />
        <EditedIndicator isEdited={!!data.edited_at} />
      </div>
    </div>
  )
}

const ActionsButtons = ({ className, message }: { className?: string; message: any }) => {
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const user = useAuthStore((state) => state.profile)
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)
  const { channelId, settings } = useChannel()

  const handleEdit = useCallback(() => {
    if (!message) return
    setEditMessageMemory(channelId, message)
  }, [channelId, message])

  const openEmojiPicker = useCallback((event: React.MouseEvent, message: TMessageWithUser) => {
    const customEvent = new CustomEvent('toggelEmojiPicker', {
      detail: {
        clickEvent: event,
        message,
        type: 'react2Message'
      }
    })
    document.dispatchEvent(customEvent)
  }, [])

  const handleReply = useCallback(() => {
    setReplyMessageMemory(message.channel_id, message)
    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [message, setReplyMessageMemory])

  const handleDeleteMessage = useCallback(async () => {
    if (!message) return
    const { error } = await deleteMessage(message.channel_id, message.id)
    if (error) {
      toast.error('Message not deleted')
    } else {
      toast.success('Message deleted')
    }
  }, [message])

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const handleReplyInThread = useCallback(() => {
    if (!editor) return

    const messageContent = message.content.trim()
    const headingId = message.channel_id

    const emptyParagraphs = Array(16).fill({
      type: ENUMS.NODES.PARAGRAPH_TYPE
    })

    // Find the heading with matching ID in the document
    const { doc } = editor.state
    let headingPos: number | null = null
    let headingLevel = 1
    let headingNode: any = null

    console.log({
      messageContent,
      headingId
    })

    // Traverse the document to find the heading with matching ID
    doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.attrs.id === headingId) {
        headingPos = pos
        headingLevel = node.attrs.level
        headingNode = node
        return false // Stop traversal once found
      }
    })

    if (headingPos !== null && headingNode) {
      // Calculate the position to insert the new heading
      // We need to find the end of the current heading's content
      const endPos = headingPos + headingNode.content.size

      const jsonNode = {
        type: ENUMS.NODES.HEADING_TYPE,
        attrs: { level: Math.min(headingLevel + 1, 9) },
        content: [
          {
            type: ENUMS.NODES.CONTENT_HEADING_TYPE,
            content: [{ type: ENUMS.NODES.TEXT_TYPE, text: messageContent }],
            attrs: { level: Math.min(headingLevel + 1, 9) }
          },
          {
            type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
            content: emptyParagraphs
          }
        ]
      }

      console.log({
        headingNode
      })

      // Create transaction to insert new heading
      editor
        .chain()
        .focus()
        .insertContentAt(Number(endPos), jsonNode, {
          updateSelection: true
        })
        .command(({ tr }) => {
          tr.setMeta('renderTOC', true)
          return true
        })
        .run()

      // Scroll to the newly inserted heading
      setTimeout(() => {
        // editor.commands.scrollIntoView()
        editor
          .chain()
          .focus(+endPos + messageContent.length + 4) // +4 move on contentWrapper node
          .scrollIntoView()
          .run()
      }, 100)
    } else if (headingPos === null) {
      // if heading not found, set pos end of document
      if (headingPos === null) headingPos = doc.content.size

      const jsonNode = {
        type: ENUMS.NODES.HEADING_TYPE,
        attrs: { level: 1 },
        content: [
          {
            type: ENUMS.NODES.CONTENT_HEADING_TYPE,
            content: [{ type: ENUMS.NODES.TEXT_TYPE, text: messageContent }],
            attrs: { level: 1 }
          },
          {
            type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
            content: emptyParagraphs
          }
        ]
      }

      console.log({
        doc,
        headingPos
      })

      // Create transaction to insert new heading
      editor
        .chain()
        .focus()
        .insertContentAt(Number(headingPos), jsonNode, {
          updateSelection: true
        })
        .command(({ tr }) => {
          tr.setMeta('renderTOC', true)
          return true
        })
        .run()

      // Scroll to the newly inserted heading
      setTimeout(() => {
        // editor.commands.scrollIntoView()
        editor
          .chain()
          .focus(+headingPos + messageContent.length + 4) // +4 move on contentWrapper node
          .scrollIntoView()
          .run()
      }, 100)
    } else {
      console.error('[reply in thread]: heading not found')
    }
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

const MessageHeader: React.FC<{ data: TMessageWithUser }> = ({ data }) => {
  const userDisplayName = data?.user_details?.display_name || data?.user_details?.fullname
  const isGroupStart = data.isGroupStart

  return (
    <div className="chat-header">
      {isGroupStart && (
        <>
          <div className="text-xs font-bold">{userDisplayName}</div>
          <time className="text-xs whitespace-nowrap opacity-50">
            {new Date(data.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </time>
        </>
      )}
    </div>
  )
}

type TMessageCardDesktopProps = {
  data: TMessageWithUser
  toggleEmojiPicker: any
  selectedEmoji: any
}

// Define the extended HTMLDivElement interface with our custom properties
interface MessageCardDesktopElement extends HTMLDivElement {
  msgId?: string
  readedAt?: string | null
  createdAt?: string | null
}

function MessageCardDesktop(
  { data, toggleEmojiPicker, selectedEmoji }: TMessageCardDesktopProps,
  ref: any
) {
  const { settings } = useChannel()
  const user = useAuthStore.use.profile()
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const cardRef = useRef<MessageCardDesktopElement>(null)

  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const isGroupEnd = data.isGroupEnd
  const isOwnerMessage = data?.user_details?.id === user?.id
  const isEmojiOnlyMessage = isOnlyEmoji(data?.content)
  const isGroupStart = data.isGroupStart

  // Attach ref and message data to DOM element
  useEffect(() => {
    if (ref) {
      ref.current = cardRef.current
    }

    if (cardRef.current) {
      cardRef.current.msgId = data.id
      cardRef.current.readedAt = data.readed_at
      cardRef.current.createdAt = data.created_at
    }
  }, [ref, data])

  const handleDoubleClick = useCallback(() => {
    if (!settings.contextMenue?.reply) return

    setReplyMessageMemory(data.channel_id, data)

    // Trigger editor focus
    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [data, settings.contextMenue?.reply, setReplyMessageMemory])

  const ProfilePic = ({ data }: { data: TMessageWithUser }) => {
    const isGroupStart = data.isGroupStart

    return (
      <div className={`avatar ${isGroupStart ? 'block' : 'hidden'}`}>
        <Avatar
          src={data?.user_details?.avatar_url}
          avatarUpdatedAt={data?.user_details?.avatar_updated_at}
          className="avatar w-10 cursor-pointer rounded-full"
          style={{
            width: 40,
            height: 40,
            cursour: 'pointer'
          }}
          id={data?.user_details?.id}
          alt={`avatar_${data?.user_details?.id}`}
        />
      </div>
    )
  }

  const renderMessageContent = () => {
    if (isEmojiOnlyMessage) {
      return (
        <div className="mb-4 max-w-[70%] min-w-full">
          {data.reply_to_message_id && <MsgReplyTo data={data} />}
          <MessageContent data={data} />
          {/* <MessageFooter data={data} /> */}
        </div>
      )
    }

    return (
      <div className="flex flex-row items-center">
        <div className="relative ml-3 flex flex-col items-center space-y-2">
          <time className="invisible relative text-xs whitespace-nowrap opacity-50 group-hover/msgcard:visible">
            {new Date(data.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </time>
        </div>
        <div className={`!mt-0 flex w-full flex-col pl-2 text-[15px] font-normal antialiased`}>
          {data.metadata?.comment && <MsgComment data={data} />}
          {data.reply_to_message_id && <MsgReplyTo data={data} />}
          <MessageContent data={data} />
          {/* <MessageFooter data={data} /> */}
          <CardIndicators data={data} />
          <ReactionsCard reactions={data.reactions} message={data} showReactionBtn={false} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group/msgcard chat msg_card hover:bg-base-200 relative w-fit w-full rounded-md pl-3 transition-colors sm:min-w-[250px]`}
      ref={cardRef}
      onDoubleClick={handleDoubleClick}>
      <ActionsButtons
        className="absolute -top-4 right-2 hidden group-hover/msgcard:block"
        message={data}
      />
      <div className="flex items-start gap-2">
        <div className="relative flex flex-col items-center space-y-2">
          <ProfilePic data={data} />
        </div>

        {isGroupStart && (
          <div className="flex flex-col">
            <MessageHeader data={data} />

            <div className={`!mt-0 flex w-full flex-col text-[15px] font-normal antialiased`}>
              {data.metadata?.comment && <MsgComment data={data} />}
              {data.reply_to_message_id && <MsgReplyTo data={data} />}
              <MessageContent data={data} />
              {/* <MessageFooter data={data} /> */}
              <CardIndicators data={data} />
              <ReactionsCard reactions={data.reactions} message={data} showReactionBtn={false} />
            </div>
          </div>
        )}
      </div>
      {!isGroupStart && renderMessageContent()}
      <MessageContextMenu
        parrentRef={cardRef}
        messageData={data}
        className="menu bg-base-100 z-20 m-0 w-48 rounded-lg p-2 shadow outline-none"
      />
    </div>
  )
}

export default React.forwardRef(MessageCardDesktop)
