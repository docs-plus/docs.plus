import { twMerge } from '@utils/twMerge'

import { useMessageAuthorDetails } from '../../../hooks/useMessageAuthorDetails'
import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}

/** Reads the author through the same query as UserAvatar, so a realtime row also gets a name. */
export const Username = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const { author, isLoading } = useMessageAuthorDetails(message)
  // `display_name` and `email` are legacy fallbacks for payloads that still carry them.
  const ud = message.user_details
  const displayName = author?.fullname || ud?.display_name || author?.username || ud?.email

  return (
    <span className={twMerge('text-xs font-bold', className)}>
      {isLoading ? (
        <span className="skeleton inline-block h-[1em] w-16 align-middle" aria-hidden />
      ) : (
        displayName
      )}
    </span>
  )
}
