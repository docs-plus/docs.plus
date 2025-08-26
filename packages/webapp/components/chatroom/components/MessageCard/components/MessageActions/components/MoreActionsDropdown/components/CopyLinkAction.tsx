import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { twMerge } from 'tailwind-merge'
import { MdOutlineLink } from 'react-icons/md'

type Props = {
  className?: string
}
export const CopyLinkAction = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const { copyMessageLinkHandler } = useCopyMessageLinkHandler()

  if (!message) return null

  return (
    <li className={twMerge('border-gray-300', className)}>
      <a className="flex items-center gap-2" onClick={() => copyMessageLinkHandler(message)}>
        <MdOutlineLink size={22} />
        Copy Link
      </a>
    </li>
  )
}
