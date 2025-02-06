import React from 'react'
import MobilePadTitle from '@components/TipTap/pad-title-section/MobilePadTitle'
import FilterModal from '../components/FilterModal'
import MobileEditor from '../components/MobileEditor'
import { useStore } from '@stores'
import TocModal from '@components/pages/document/components/TocModal'
import ChatContainerMobile from '@components/pages/document/components/chat/ChatContainerMobile'
import BigPencilBtn from '@components/pages/document/components/BigPencilBtn'
import { ModalDrawer } from '@components/ui/ModalDrawer'
import { useHashRouter } from '@hooks/useHashRouter'
import MobileHistory from '@components/pages/history/mobile/MobileHistory'
const MobileLeftSidePanel = () => {
  return (
    <ModalDrawer modalId="mobile_left_side_panel" width={80}>
      <TocModal />
    </ModalDrawer>
  )
}

const MobileLayout = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  const isHistoryView = useHashRouter()

  if (isHistoryView) return <MobileHistory />

  return (
    <div className={`pad tiptap relative flex flex-col border-solid ${deviceClass}`}>
      <MobilePadTitle />
      <MobileLeftSidePanel />
      <MobileEditor />
      <BigPencilBtn />
      <ChatContainerMobile />
      <FilterModal />
    </div>
  )
}

export default MobileLayout
