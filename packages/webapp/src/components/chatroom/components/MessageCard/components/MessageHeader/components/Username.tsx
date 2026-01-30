import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}
export const Username = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const displayName = useMemo(() => {
    return (
      message.user_details?.display_name ||
      message.user_details?.full_name ||
      message.user_details?.username ||
      message.user_details?.email
    )
  }, [
    message.user_details?.display_name,
    message.user_details?.username,
    message.user_details?.full_name
  ])
  return <span className={twMerge('text-xs font-bold', className)}>{displayName}</span>
}
