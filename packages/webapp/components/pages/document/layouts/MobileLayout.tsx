import React, { useRef, useState } from 'react'
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
import { Sheet } from 'react-modal-sheet'

const MobileLeftSidePanel = ({ filterModalRef, setIsFilterModalOpen }: any) => {
  return (
    <ModalDrawer modalId="mobile_left_side_panel" width={80}>
      <TocModal filterModalRef={filterModalRef} setIsFilterModalOpen={setIsFilterModalOpen} />
    </ModalDrawer>
  )
}

const MobileLayout = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

  const filterModalRef = useRef<HTMLDivElement>(null)
  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  const isHistoryView = useHashRouter()

  if (isHistoryView) return <MobileHistory />

  return (
    <div className={`tiptap relative flex h-full w-full flex-col ${deviceClass}`}>
      <MobilePadTitle />
      <MobileLeftSidePanel
        filterModalRef={filterModalRef}
        setIsFilterModalOpen={setIsFilterModalOpen}
      />
      <MobileEditor />
      <BigPencilBtn />
      <ChatContainerMobile />

      <Sheet
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        snapPoints={[0.5, 0]}
        modalEffectRootId="filter_sheet"
        id="filter_sheet">
        <Sheet.Container>
          <Sheet.Content>
            <FilterModal setIsFilterModalOpen={setIsFilterModalOpen} />
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop />
      </Sheet>
    </div>
  )
}

export default MobileLayout
