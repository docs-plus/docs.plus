import { Avatar } from '@components/ui/Avatar'
import { TGroupedMsgRow } from '@types'
import { SIZE_CLASSES } from '@utils/avatarStackGeometry'
import { twMerge } from '@utils/twMerge'

import { useMessageAuthorDetails } from '../../../hooks/useMessageAuthorDetails'
import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}

export const ProfilePic = ({ message }: { message: TGroupedMsgRow }) => {
  const { author, isLoading } = useMessageAuthorDetails(message)
  const isGroupStart = message.isGroupStart
  const userId = author?.id ?? message.user_id

  // A generated face would read as loaded content, so a pending author shows a round bone.
  return (
    <div className={isGroupStart ? 'block' : 'hidden'}>
      {isLoading ? (
        <div className={twMerge('skeleton rounded-full', SIZE_CLASSES.md)} aria-hidden />
      ) : (
        <Avatar face={{ ...author, id: userId }} size="md" />
      )}
    </div>
  )
}

export const UserAvatar = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  return (
    <div className={twMerge('relative flex flex-col items-center space-y-2', className)}>
      <ProfilePic message={message} />
    </div>
  )
}
