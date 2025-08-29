import { Chatroom } from '@components/chatroom'
import { HoverMenuDropdown } from '@components/ui/HoverMenu'
import { MdMoreVert } from 'react-icons/md'

type Props = {
  className?: string
}

export const HoverMenuActions = ({ className }: Props) => {
  return (
    <>
      <Chatroom.MessageFeed.MessageList.MessageCard.Actions.EmojiReaction />
      <Chatroom.MessageFeed.MessageList.MessageCard.Actions.Reply />
      <Chatroom.MessageFeed.MessageList.MessageCard.Actions.ReplyInThread />
      <Chatroom.MessageFeed.MessageList.MessageCard.Actions.Bookmark />

      <HoverMenuDropdown
        tooltip="More Actions"
        trigger={<MdMoreVert size={20} className="text-gray-600" />}>
        <Chatroom.MessageFeed.MessageList.MessageCard.Actions.CopyToDoc />
        <Chatroom.MessageFeed.MessageList.MessageCard.Actions.CopyLink />
        <Chatroom.MessageFeed.MessageList.MessageCard.Actions.GroupAuth
          checkMessageAuthor={true}
          className="mt-1 border-t border-gray-300 pt-1">
          <Chatroom.MessageFeed.MessageList.MessageCard.Actions.Delete />
          <Chatroom.MessageFeed.MessageList.MessageCard.Actions.Edit />
        </Chatroom.MessageFeed.MessageList.MessageCard.Actions.GroupAuth>
        <Chatroom.MessageFeed.MessageList.MessageCard.Actions.ReadStatus />
      </HoverMenuDropdown>
    </>
  )
}
