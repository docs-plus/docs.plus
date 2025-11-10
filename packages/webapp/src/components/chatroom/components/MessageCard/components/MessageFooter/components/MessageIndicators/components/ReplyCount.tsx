import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { CgMailReply } from 'react-icons/cg'
import { twMerge } from 'tailwind-merge'
import { getMetadataProperty } from '@utils/metadata'

type Props = {
  className?: string
}

export const ReplyCount = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const replied = getMetadataProperty<string[]>(message.metadata, 'replied')
  const counts = replied?.length
  if (!counts) return null

  return (
    <div className={twMerge('flex items-center', className)}>
      <CgMailReply size={16} className="text-base-content text-opacity-50" />
      <span className="text-xs">{counts}</span>
    </div>
  )
}
