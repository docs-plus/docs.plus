import { useCopyMessageToDocHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageToDocHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { Icons } from '@icons'

export const CopyToDocAction = () => {
  const { copyMessageToDocHandler } = useCopyMessageToDocHandler()
  const { message } = useMessageCardContext()

  if (!message) return null

  return (
    <li>
      <a className="flex items-center gap-2" onClick={() => copyMessageToDocHandler(message)}>
        <Icons.fileOpen size={18} />
        Copy to doc
      </a>
    </li>
  )
}
