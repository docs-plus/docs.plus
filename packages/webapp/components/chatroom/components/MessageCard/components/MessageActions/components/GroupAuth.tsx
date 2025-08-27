import { useAuthStore } from '@stores'
import { twMerge } from 'tailwind-merge'
import { useMessageCardContext } from '../../../MessageCardContext'
import { useMemo } from 'react'

type Props = {
  children: React.ReactNode
  className?: string
  checkMessageAuthor?: boolean
}
export const GroupAuth = ({ children, className, checkMessageAuthor = false }: Props) => {
  const profile = useAuthStore((state) => state.profile)
  const { message } = useMessageCardContext()
  const isMessageAuthor = useMemo(
    () => message?.user_details?.id === profile?.id,
    [message, profile]
  )

  if (!profile || (checkMessageAuthor && !isMessageAuthor)) return null

  return <div className={twMerge('group-auth', className)}>{children}</div>
}
