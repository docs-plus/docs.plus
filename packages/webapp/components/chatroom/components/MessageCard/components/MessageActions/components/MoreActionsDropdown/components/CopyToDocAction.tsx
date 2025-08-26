import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { useCopyMessageToDocHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageToDocHandler'
import { MdOutlineFileOpen } from 'react-icons/md'

type Props = {}
export const CopyToDocAction = ({}: Props) => {
  const { copyMessageToDocHandler } = useCopyMessageToDocHandler()
  const { message } = useMessageCardContext()

  if (!message) return null

  return (
    <li>
      <a className="flex items-center gap-2" onClick={() => copyMessageToDocHandler(message)}>
        <MdOutlineFileOpen size={20} />
        Copy to doc
      </a>
    </li>
  )
}
