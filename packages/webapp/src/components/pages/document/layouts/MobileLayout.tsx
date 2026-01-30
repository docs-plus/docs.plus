import BottomSheet from '@components/BottomSheet'
import EditFAB from '@components/pages/document/components/EditFAB'
import TocModal from '@components/pages/document/components/TocModal'
import MobileHistory from '@components/pages/history/mobile/MobileHistory'
import MobilePadTitle from '@components/TipTap/pad-title-section/MobilePadTitle'
import { ModalDrawer } from '@components/ui/ModalDrawer'
import { useHashRouter } from '@hooks/useHashRouter'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'
import { useStore } from '@stores'
import React, { useRef } from 'react'

import MobileEditor from '../components/MobileEditor'
import ToolbarMobile from '../components/toolbarMobile/ToolbarMobile'

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
  useVirtualKeyboard()

  if (isHistoryView) return <MobileHistory />

  return (
    <div className={`mobileLayoutRoot tiptap flex w-full flex-col ${deviceClass}`}>
      <div className="sticky top-0 z-20 w-full bg-white">
        <MobilePadTitle />
      </div>
      <MobileLeftSidePanel />
      <MobileEditor />
      <EditFAB />
      <BottomSheet />
      <div className="mobileToolbarBottom sticky bottom-0 left-0 z-20 w-full bg-white">
        <ToolbarMobile />
      </div>
    </div>
  )
}

export default MobileLayout
