import { twMerge } from '@utils/twMerge'

import { useMessageAuthorDetails } from '../../../hooks/useMessageAuthorDetails'
import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}

/** Reads the author through the same query as UserAvatar, so a realtime row also gets a name. */
export const Username = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const { displayName, isLoading } = useMessageAuthorDetails(message)

  return (
    <span className={twMerge('text-xs font-bold', className)}>
      {isLoading ? (
        <span className="skeleton inline-block h-3 w-16 align-middle" aria-hidden />
      ) : (
        displayName
      )}
    </span>
  )
}
