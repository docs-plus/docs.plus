import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'
import DesktopHistory from '@components/pages/history/desktop/DesktopHistory'
import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import { useHashRouter } from '@hooks/useHashRouter'
import { useStore } from '@stores'
import React from 'react'

import DesktopEditor from '../components/DesktopEditor'

const DesktopLayout = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'
  const isHistoryView = useHashRouter()

  if (isHistoryView) return <DesktopHistory />

  return (
    <div className={`pad tiptap relative flex h-full flex-col border-solid ${deviceClass}`}>
      <PadTitle />
      <DesktopEditor />
      <EmojiPanel variant="desktop">
        <EmojiPanel.Selector />
      </EmojiPanel>
    </div>
  )
}

export default DesktopLayout
