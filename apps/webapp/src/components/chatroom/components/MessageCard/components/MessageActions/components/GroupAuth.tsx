import { ContextMenuDivider } from '@components/ui/ContextMenu'
import { useAuthStore } from '@stores'
import { useMemo } from 'react'

import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  children: React.ReactNode
  checkMessageAuthor?: boolean
  /** Divider row before the group. It hides with the group, so no orphan line remains. */
  separatorBefore?: boolean
}

// A fragment, not a wrapper: menu rows must stay direct children of the list.
export const GroupAuth = ({
  children,
  checkMessageAuthor = false,
  separatorBefore = false
}: Props) => {
  const profile = useAuthStore((state) => state.profile)
  const { message } = useMessageCardContext()
  const isMessageAuthor = useMemo(
    () => message?.user_details?.id === profile?.id,
    [message, profile]
  )

  if (!profile || (checkMessageAuthor && !isMessageAuthor)) return null

  return (
    <>
      {separatorBefore && <ContextMenuDivider />}
      {children}
    </>
  )
}
