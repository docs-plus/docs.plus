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
        tooltip="More actions"
        trigger={<Icons.moreVertical size={18} className="text-base-content/70" />}>
        <MessageCard.Actions.Download />
        <MessageCard.Actions.CopyToDoc />
        <MessageCard.Actions.CopyLink />
        <MessageCard.Actions.GroupAuth checkMessageAuthor separatorBefore>
          <MessageCard.Actions.Edit />
          <MessageCard.Actions.Delete />
        </MessageCard.Actions.GroupAuth>
        <MessageCard.Actions.ReadStatus />
      </HoverMenuDropdown>
    </>
  )
}
