import React from 'react'
import { useUserModal } from '@context/UserModalContext'

export const useMentionClick = () => {
  const { openUserModal } = useUserModal()

  const handleMentionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement

    if (target.matches('.mention[data-id]')) {
      const userId = target.dataset.id
      if (userId) openUserModal(userId)
    }
  }

  return handleMentionClick
}
