import React, { forwardRef, useMemo, useCallback } from 'react'
import { deleteMessage, pinMessage } from '@api'
import {
  BsReplyFill,
  BsForwardFill,
  BsFillPinFill,
  BsFillTrashFill,
  BsFillPinAngleFill
} from 'react-icons/bs'
import { RiPencilFill } from 'react-icons/ri'
// import { useForwardMessageModalStore } from '@/components/messages/components/ForwardMessageModal'
import toast from 'react-hot-toast'
import { ContextMenu, MenuItem } from './components/ui/ContextMenu'
import { useAuthStore, useChatStore } from '@stores'
import { BiSolidMessageDetail } from 'react-icons/bi'
import { useChannel } from './context/ChannelProvider'

export const MessageContextMenu = forwardRef<
  HTMLUListElement,
  { messageData: any; className: string; parrentRef: any }
>(({ messageData, className, parrentRef }, ref) => {
  const { channelId, settings } = useChannel()

  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo(() => channels.get(channelId) ?? {}, [channels, channelId])

  // const openModal = useForwardMessageModalStore((state: any) => state.openModal)
  const addChannelPinnedMessage = useChatStore((state) => state.addChannelPinnedMessage)
  const removeChannelPinnedMessage = useChatStore((state) => state.removeChannelPinnedMessage)
  const { workspaceBroadcaster } = useChatStore((state) => state.workspaceSettings)
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)
  const setReplayMessageMemory = useChatStore((state) => state.setReplayMessageMemory)
  const user = useAuthStore((state) => state.profile)

  const handleReplayMessage = useCallback(() => {
    if (!messageData) return
    setReplayMessageMemory(channelId, messageData)
    // Trigger editor focus
    const event = new CustomEvent('editor:focus')
    document.dispatchEvent(event)
  }, [channelId, messageData])

  const handleDeleteMessage = useCallback(async () => {
    if (!messageData) return
    const { error } = await deleteMessage(messageData.channel_id, messageData.id)
    if (error) {
      toast.error('Message not deleted')
    } else {
      toast.success('Message deleted')
    }
  }, [messageData])

  const handlePinMessage = useCallback(async () => {
    if (!messageData) return
    const actionType = messageData.metadata?.pinned ? 'unpin' : 'pin'
    const { error } = await pinMessage(messageData.channel_id, messageData.id, actionType)
    if (error) {
      toast.error(`Message not ${actionType}`)
    } else {
      toast.success(`Message ${actionType} successfully`)
      actionType === 'pin'
        ? addChannelPinnedMessage(messageData.channel_id, messageData)
        : removeChannelPinnedMessage(messageData.channel_id, messageData.id)

      await workspaceBroadcaster.send({
        type: 'broadcast',
        event: 'pinnedMessage',
        payload: { message: messageData, actionType }
      })
    }
  }, [messageData])

  const handleEdit = useCallback(() => {
    if (!messageData) return
    setEditMessageMemory(channelId, messageData)
  }, [channelId, messageData])

  const handleThread = useCallback(() => {
    if (!messageData) return
    useChatStore.getState().setStartThreadMessage(messageData)
  }, [messageData])

  const isPinned = useMemo(() => {
    return messageData?.metadata?.pinned
  }, [messageData])

  const messageButtonList = [
    {
      title: 'Replay',
      icon: <BsReplyFill size={20} />,
      onClickFn: handleReplayMessage,
      display: settings.contextMenue?.reply ?? true
    },
    {
      title: 'Forward',
      icon: <BsForwardFill size={20} />,
      onClickFn: () => {}, //openModal('forwardMessageModal', messageData),
      display: settings.contextMenue?.forward ?? true
    },
    {
      title: isPinned ? 'Unpin' : 'Pin',
      icon: isPinned ? <BsFillPinAngleFill size={20} /> : <BsFillPinFill size={20} />,
      onClickFn: () => handlePinMessage(),
      display: settings.contextMenue?.pin ?? true
    },
    {
      title: 'Edit',
      icon: <RiPencilFill size={20} />,
      onClickFn: () => handleEdit(),
      display: settings.contextMenue?.edite ?? true
    },
    {
      title: 'Delete',
      icon: <BsFillTrashFill size={20} />,
      onClickFn: () => handleDeleteMessage(),
      display: settings.contextMenue?.delete ?? true
    }
  ]

  // Do not show edit and delete button if user is not the owner of the message
  if (user && messageData.user_id !== user.id) {
    delete messageButtonList[3]
    delete messageButtonList[4]
  }

  if (!channelId) return null

  // Do not show context menu if user is not a member of the channel
  //@ts-ignore
  if (!channelSettings.isUserChannelMember) return

  return (
    <ContextMenu className={className} parrentRef={parrentRef} ref={ref}>
      {settings.contextMenue?.replyInThread && (
        <MenuItem onClick={handleThread} className="border-b pb-1">
          <a href="#" className="no-underline">
            <BiSolidMessageDetail size={20} />
            Reply in Thread
          </a>
        </MenuItem>
      )}

      {messageButtonList.map(
        (item) =>
          item.display && (
            <MenuItem key={item.title} onClick={item.onClickFn}>
              <a href="#" className="no-underline">
                {item.icon}
                {item.title}
              </a>
            </MenuItem>
          )
      )}
    </ContextMenu>
  )
})

MessageContextMenu.displayName = 'MessageContextMenu'
