import React from 'react'

import { EmojiPanelProvider, type EmojiPanelVariant } from './context/EmojiPanelContext'
import { Picker } from './Picker'
import { EmojiSelector } from './Selector'

const EmojiPanel = ({
  children,
  variant,
  onSelect
}: {
  children: React.ReactNode
  variant: EmojiPanelVariant
  onSelect: (native: string) => void
}) => {
  return (
    <EmojiPanelProvider variant={variant} onSelect={onSelect}>
      <div id="emoji_panel">{children}</div>
    </EmojiPanelProvider>
  )
}

export default EmojiPanel

EmojiPanel.Selector = EmojiSelector
EmojiPanel.Picker = Picker
