import React from 'react'
import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import DesktopEditor from '../components/DesktopEditor'
import { useStore } from '@stores'
import { useHashRouter } from '@hooks/useHashRouter'
import DesktopHistory from '@components/pages/history/desktop/DesktopHistory'
import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'

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
