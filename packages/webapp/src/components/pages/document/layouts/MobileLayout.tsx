import React, { useRef } from 'react'
import MobilePadTitle from '@components/TipTap/pad-title-section/MobilePadTitle'
import MobileEditor from '../components/MobileEditor'
import { useStore } from '@stores'
import TocModal from '@components/pages/document/components/TocModal'
import BigPencilBtn from '@components/pages/document/components/BigPencilBtn'
import { ModalDrawer } from '@components/ui/ModalDrawer'
import { useHashRouter } from '@hooks/useHashRouter'
import MobileHistory from '@components/pages/history/mobile/MobileHistory'
import BottomSheet from '@components/BottomSheet'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'
import ToolbarMobile from '../components/toolbarMobile/ToolbarMobile'

const MobileLeftSidePanel = ({ filterModalRef }: any) => {
  return (
    <ModalDrawer modalId="mobile_left_side_panel" width={80}>
      <TocModal filterModalRef={filterModalRef} />
    </ModalDrawer>
  )
}

const MobileLayout = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const filterModalRef = useRef<HTMLDivElement>(null)
  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  const isHistoryView = useHashRouter()
  useVirtualKeyboard()

  if (isHistoryView) return <MobileHistory />

  return (
    <div className={`mobileLayoutRoot tiptap flex w-full flex-col ${deviceClass}`}>
      <div className="sticky top-0 z-20 w-full bg-white">
        <MobilePadTitle />
      </div>
      <MobileLeftSidePanel filterModalRef={filterModalRef} />
      <MobileEditor />
      <BigPencilBtn />
      <BottomSheet />
      <div className="mobileToolbarBottom sticky bottom-0 left-0 z-20 w-full bg-white">
        <ToolbarMobile />
      </div>
    </div>
  )
}

export default MobileLayout
