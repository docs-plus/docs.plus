import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { Icons } from '@icons'
import { getMetadataProperty } from '@utils/metadata'
import { twMerge } from 'tailwind-merge'

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
      <Icons.reply size={16} className="text-base-content/50" />
      <span className="text-xs">{counts}</span>
    </div>
  )
}
