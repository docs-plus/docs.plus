import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { twMerge } from 'tailwind-merge'
import { MdOutlineLink, MdCheck } from 'react-icons/md'

type Props = {
  className?: string
}

export const CopyLinkAction = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const { copyMessageLinkHandler, copied } = useCopyMessageLinkHandler()

  if (!message) return null

  return (
    <li className={twMerge('border-base-300', className)}>
      <a className="flex items-center gap-2" onClick={() => copyMessageLinkHandler(message)}>
        {copied ? (
          <>
            <MdCheck size={22} className="text-success" />
            <span className="text-success">Copied!</span>
          </>
        ) : (
          <>
            <MdOutlineLink size={22} />
            Copy Link
          </>
        )}
      </a>
    </li>
  )
}
