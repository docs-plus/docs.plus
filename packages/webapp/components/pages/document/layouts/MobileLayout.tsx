import React from 'react'
import MobilePadTitle from '@components/TipTap/pad-title-section/MobilePadTitle'
import FilterModal from '../components/FilterModal'
import MobileEditor from '../components/MobileEditor'
import { useStore } from '@stores'
import TocModal from '@components/pages/document/components/TocModal'
import ChatContainerMobile from '@components/pages/document/components/chat/ChatContainerMobile'

const MobileLeftSidePanel = () => {
  return (
    <div className="drawer z-30 w-full">
      <input id="mobile_left_side_panel" type="checkbox" className="drawer-toggle" />
      <div className="drawer-side">
        <label
          htmlFor="mobile_left_side_panel"
          aria-label="close sidebar"
          className="drawer-overlay"></label>
        <div className="min-h-full w-full">
          <label htmlFor="mobile_left_side_panel">
            <TocModal />
          </label>
        </div>
      </div>
    </div>
  )
}

const MobileLayout = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  return (
    <div className={`pad tiptap relative flex flex-col border-solid ${deviceClass}`}>
      <div className="docTitle sticky top-0 z-10 flex min-h-14 w-full flex-row items-center bg-white">
        <MobilePadTitle />
      </div>
      <MobileLeftSidePanel />
      <MobileEditor />
      <ChatContainerMobile />
      <FilterModal />
    </div>
  )
}

export default MobileLayout
