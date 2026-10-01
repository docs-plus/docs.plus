import SharedCloseButton from '@components/ui/CloseButton'
import { closeHeadingChatroom } from '@services/eventsHub'

type Props = {
  className?: string
}

export const CloseButton = ({ className }: Props) => {
  return (
    <SharedCloseButton
      onClick={closeHeadingChatroom}
      className={className}
      aria-label="Close chat"
      tooltip="Close chat"
    />
  )
}
