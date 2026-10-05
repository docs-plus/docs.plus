import { UserReadStatus } from '@components/chatroom/components/MessageCard/components/common/UserReadStatus'
import ContextMenuItems from '@components/chatroom/components/MessageCard/components/MessageContextMenu/ContextMenuItems'
import { MessageCard } from '@components/chatroom/components/MessageCard/MessageCard'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { HoverMenuDropdown } from '@components/ui/HoverMenu'
import { Icons } from '@icons'

export const HoverMenuActions = () => {
  const { message } = useMessageCardContext()

  return (
    <>
      <MessageCard.Actions.EmojiReaction />
      <MessageCard.Actions.Reply />
      <MessageCard.Actions.ReplyInThread />
      <MessageCard.Actions.Bookmark />

      <HoverMenuDropdown
        tooltip="More actions"
        trigger={<Icons.moreVertical size={18} className="text-base-content/70" />}>
        <ContextMenuItems
          message={message}
          only={['copy-link', 'download', 'copy-to-doc', 'edit', 'delete']}
        />
        <UserReadStatus message={message} />
      </HoverMenuDropdown>
    </>
  )
}
