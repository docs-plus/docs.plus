import React from 'react'

import { EmojiPanelProvider } from './context/EmojiPanelContext'
import { Picker } from './Picker'
import { EmojiSelector } from './Selector'

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
