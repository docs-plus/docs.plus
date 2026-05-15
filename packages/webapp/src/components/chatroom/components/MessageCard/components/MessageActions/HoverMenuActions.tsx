import { MessageCard } from '@components/chatroom/components/MessageCard/MessageCard'
import { HoverMenuDropdown } from '@components/ui/HoverMenu'
import { Icons } from '@icons'

export const HoverMenuActions = () => {
  return (
    <>
      <MessageCard.Actions.EmojiReaction />
      <MessageCard.Actions.Reply />
      <MessageCard.Actions.ReplyInThread />
      <MessageCard.Actions.Bookmark />

      <HoverMenuDropdown
        tooltip="More Actions"
        trigger={<Icons.moreVertical size={18} className="text-base-content/60" />}>
        <MessageCard.Actions.CopyToDoc />
        <MessageCard.Actions.CopyLink />
        <MessageCard.Actions.GroupAuth
          checkMessageAuthor={true}
          className="border-base-300 mt-1 border-t pt-1">
          <MessageCard.Actions.Delete />
          <MessageCard.Actions.Edit />
        </MessageCard.Actions.GroupAuth>
        <MessageCard.Actions.ReadStatus />
      </HoverMenuDropdown>
    </>
  )
}
