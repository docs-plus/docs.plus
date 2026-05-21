import { emojiReaction } from '@api'
import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'
import DesktopHistory from '@components/pages/history/desktop/DesktopHistory'
import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import { useHashRouter } from '@hooks/useHashRouter'
import { useChatStore, useStore } from '@stores'
import React, { useCallback } from 'react'

import DesktopEditor from '../components/DesktopEditor'

const DesktopLayout = () => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'
  const { isHistoryView } = useHashRouter()

  // Desktop picker has two roles (react to message vs. insert into editor)
  // discriminated by `emojiPicker.eventType`; read fresh at click-time so
  // the handler identity stays stable.
  const handleSelect = useCallback((native: string) => {
    const chat = useChatStore.getState()
    if (chat.emojiPicker.eventType === 'reactToMessage') {
      emojiReaction(chat.emojiPicker.selectedMessage, native)
    } else {
      chat.chatRoom.editorInstance?.commands.insertContent(native)
    }
    chat.closeEmojiPicker()
  }, [])

  if (isHistoryView) return <DesktopHistory />

  return (
    <div className={`pad tiptap relative flex h-full flex-col border-solid ${deviceClass}`}>
      <PadTitle />
      <DesktopEditor />
      <EmojiPanel variant="desktop" onSelect={handleSelect}>
        <EmojiPanel.Selector />
      </EmojiPanel>
    </div>
  )
}

export default DesktopLayout
