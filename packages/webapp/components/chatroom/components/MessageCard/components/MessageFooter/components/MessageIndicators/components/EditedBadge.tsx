import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

export const EditedBadge = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const isEdited = !!message.edited_at
  if (!isEdited) return null

  return (
    <span className={twMerge('text-base-content text-opacity-50 text-xs', className)}>edited</span>
  )
}
