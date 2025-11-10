import React, { useCallback } from 'react'
import { useStore } from '@stores'
import { UserProfileDialog } from '@components/ui/dialogs/UserProfileDialog'

export const useMentionClick = () => {
  const openDialog = useStore((state) => state.openDialog)

  const handleMentionClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const mentionElement = (event.target as HTMLElement | null)?.closest?.(
        '[data-type="mention"][data-id]'
      ) as HTMLElement | null

      const userId = mentionElement?.dataset?.id?.trim()
      if (!userId) return

      openDialog(<UserProfileDialog userId={userId} />, {
        size: 'md'
      })
    },
    [openDialog]
  )

  return handleMentionClick
}
