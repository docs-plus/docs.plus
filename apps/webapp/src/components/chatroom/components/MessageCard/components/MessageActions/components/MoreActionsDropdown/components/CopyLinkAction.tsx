import { messageActionTitle } from '@components/chatroom/components/MessageCard/hooks/messageActionMenu'
import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

export const CopyLinkAction = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const { copyMessageLinkHandler, copied } = useCopyMessageLinkHandler()

  if (!message) return null

  return (
    <li className={twMerge('border-base-300', className)}>
      <button
        type="button"
        className={twMerge('flex items-center gap-2', copied && 'text-success')}
        aria-label={copied ? 'Copied!' : messageActionTitle.copyLink}
        onClick={() => copyMessageLinkHandler(message)}>
        <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
          <Icons.check size={18} className="swap-on text-success" />
          <Icons.link size={18} className="swap-off" />
        </span>
        <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
          <span className="swap-on">Copied!</span>
          <span className="swap-off">{messageActionTitle.copyLink}</span>
        </span>
      </button>
    </li>
  )
}
