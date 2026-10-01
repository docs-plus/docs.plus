import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { twMerge } from '@utils/twMerge'

type Props = {
  className?: string
}

export const EditedBadge = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const isEdited = !!message.edited_at
  if (!isEdited) return null

  return <span className={twMerge('text-base-content/60 text-xs', className)}>edited</span>
}
