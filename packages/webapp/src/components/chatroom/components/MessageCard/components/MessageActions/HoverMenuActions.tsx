import { Chatroom } from '@components/chatroom'
import { HoverMenuDropdown } from '@components/ui/HoverMenu'
import { Icons } from '@icons'

export const HoverMenuActions = () => {
  return (
    <>
      <Chatroom.MessageFeed.MessageList.MessageCard.Actions.EmojiReaction />
      <Chatroom.MessageFeed.MessageList.MessageCard.Actions.Reply />
      <Chatroom.MessageFeed.MessageList.MessageCard.Actions.ReplyInThread />
      <Chatroom.MessageFeed.MessageList.MessageCard.Actions.Bookmark />

      <HoverMenuDropdown
        tooltip="More Actions"
        trigger={<Icons.moreVertical size={18} className="text-base-content/60" />}>
        <Chatroom.MessageFeed.MessageList.MessageCard.Actions.CopyToDoc />
        <Chatroom.MessageFeed.MessageList.MessageCard.Actions.CopyLink />
        <Chatroom.MessageFeed.MessageList.MessageCard.Actions.GroupAuth
          checkMessageAuthor={true}
          className="border-base-300 mt-1 border-t pt-1">
          <Chatroom.MessageFeed.MessageList.MessageCard.Actions.Delete />
          <Chatroom.MessageFeed.MessageList.MessageCard.Actions.Edit />
        </Chatroom.MessageFeed.MessageList.MessageCard.Actions.GroupAuth>
        <Chatroom.MessageFeed.MessageList.MessageCard.Actions.ReadStatus />
      </HoverMenuDropdown>
    </>
  )
}
