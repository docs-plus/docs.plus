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
      <a className="flex items-center gap-2" onClick={() => copyMessageLinkHandler(message)}>
        {copied ? (
          <>
            <Icons.check size={22} className="text-success" />
            <span className="text-success">Copied!</span>
          </>
        ) : (
          <>
            <Icons.link size={22} />
            Copy Link
          </>
        )}
      </a>
    </li>
  )
}
