import React, { createContext, useContext } from 'react'

type EmojiPanelContextType = {
  variant: 'mobile' | 'desktop'
}

const EmojiPanelContext = createContext<EmojiPanelContextType | undefined>(undefined)

export const useEmojiPanelContext = () => {
  const context = useContext(EmojiPanelContext)
  if (!context) {
    throw new Error('useEmojiPanelContext must be used within EmojiPanelProvider')
  }
  return context
}

export const EmojiPanelProvider: React.FC<{
  children: React.ReactNode
  variant: 'mobile' | 'desktop'
}> = ({ children, variant }) => {
  return <EmojiPanelContext.Provider value={{ variant }}>{children}</EmojiPanelContext.Provider>
}
