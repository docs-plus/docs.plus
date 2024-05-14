import { useEffect } from 'react'
import { useChatStore } from '@stores'

const maxDisplayedUsers = 3

const getDisplayText = (users: any, dataMsg: string) => {
  if (users.length >= maxDisplayedUsers) {
    return `${users.length} users are typing...`
  }
  if (users.length > 0) {
    return `${users.map((user: any) => user.displayName).join(', ')} is typing...`
  }
  return dataMsg || ''
}

const updateIndicator = (channelId: string, typingIndicator: Map<string, any>) => {
  const users = Array.from(typingIndicator.values())
  // this way is better than to render, better performance
  const elIndicator = document?.querySelector(`.msgIndicator`)
  const dataMsg = elIndicator?.getAttribute('data-msg') || ''

  if (elIndicator) {
    elIndicator.textContent = getDisplayText(users, dataMsg)
  }
}

export const useTypingIndicator = () => {
  const { typingIndicators } = useChatStore((state) => state.workspaceSettings)

  useEffect(() => {
    console.log({
      typingIndicators
    })
    Object.keys(typingIndicators).forEach((channelId) => {
      const typingIndicator = typingIndicators[channelId]
      if (typingIndicator) {
        updateIndicator(channelId, typingIndicator)
      }
    })
  }, [typingIndicators])
}
