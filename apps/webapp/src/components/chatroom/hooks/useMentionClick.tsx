import { UserProfileDialog } from '@components/ui/dialogs/UserProfileDialog'
import { userProfileDialogOpenConfig } from '@components/ui/dialogs/userProfileDialogOpenConfig'
import { useStore } from '@stores'
import React, { useCallback } from 'react'

export const useMentionClick = () => {
  const openDialog = useStore((state) => state.openDialog)

  const handleMentionClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const mentionElement = (event.target as HTMLElement | null)?.closest?.(
        '[data-type="mention"][data-id]'
      ) as HTMLElement | null

      const userId = mentionElement?.dataset?.id?.trim()
      if (!userId || userId === 'everyone' || userId === '0') return

      openDialog(<UserProfileDialog userId={userId} />, userProfileDialogOpenConfig)
    },
    [openDialog]
  )

  return handleMentionClick
}
