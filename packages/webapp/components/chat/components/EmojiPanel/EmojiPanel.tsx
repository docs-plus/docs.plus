import React from 'react'
import { EmojiSelector } from './Selector'
import { Picker } from './Picker'
import { EmojiPanelProvider } from './context/EmojiPanelContext'

const EmojiPanel = ({
  children,
  variant
}: {
  children: React.ReactNode
  variant: 'mobile' | 'desktop'
}) => {
  return (
    <EmojiPanelProvider variant={variant}>
      <div id="emoji_panel">{children}</div>
    </EmojiPanelProvider>
  )
}

export default EmojiPanel

EmojiPanel.Selector = EmojiSelector
EmojiPanel.Picker = Picker
