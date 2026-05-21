import React, { createContext, useContext } from 'react'

export type EmojiPanelVariant = 'mobile' | 'desktop'

type EmojiPanelContextType = {
  variant: EmojiPanelVariant
  onSelect: (native: string) => void
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
  variant: EmojiPanelVariant
  onSelect: (native: string) => void
}> = ({ children, variant, onSelect }) => (
  <EmojiPanelContext.Provider value={{ variant, onSelect }}>{children}</EmojiPanelContext.Provider>
)
