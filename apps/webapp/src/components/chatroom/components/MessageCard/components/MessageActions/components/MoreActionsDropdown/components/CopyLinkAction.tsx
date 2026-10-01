import { messageActionTitle } from '@components/chatroom/components/MessageCard/hooks/messageActionMenu'
import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { ContextMenuRow, MenuItem } from '@components/ui/ContextMenu'
import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'

type Props = {
  className?: string
}

export const CopyLinkAction = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const { copyMessageLinkHandler, copied } = useCopyMessageLinkHandler()

  if (!message) return null

  // The swap spans are aria-hidden, so the row carries its name here. The label swap
  // is inline-grid; `align-top` drops its baseline gap, so the row keeps the 36px height.
  return (
    <MenuItem
      className={className}
      aria-label={copied ? 'Copied!' : messageActionTitle.copyLink}
      onClick={() => copyMessageLinkHandler(message)}>
      <ContextMenuRow
        icon={
          <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
            <Icons.check size={16} className="swap-on text-success" />
            <Icons.link size={16} className="swap-off" />
          </span>
        }
        className={twMerge(copied && 'text-[var(--success-ink)]')}>
        <span className={twMerge('swap align-top', copied && 'swap-active')} aria-hidden>
          <span className="swap-on">Copied!</span>
          <span className="swap-off">{messageActionTitle.copyLink}</span>
        </span>
      </ContextMenuRow>
    </MenuItem>
  )
}
