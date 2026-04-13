import BottomSheet from '@components/BottomSheet'
import EditFAB from '@components/pages/document/components/EditFAB'
import TocModal from '@components/pages/document/components/TocModal'
import MobileHistory from '@components/pages/history/mobile/MobileHistory'
import MobilePadTitle from '@components/TipTap/pad-title-section/MobilePadTitle'
import ToolbarMobile from '@components/TipTap/toolbar/mobile/ToolbarMobile'
import { ModalDrawer } from '@components/ui/ModalDrawer'
import { useHashRouter } from '@hooks/useHashRouter'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'
import { useVisualViewportCssSyncOnFocus } from '@hooks/useVisualViewportCssSyncOnFocus'
import { useStore } from '@stores'

import MobileEditor from '../components/MobileEditor'

const MobileLeftSidePanel = () => {
  return (
    <ModalDrawer modalId="mobile_left_side_panel" width={80}>
      <TocModal />
    </ModalDrawer>
  )
}

const MobileLayout = () => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  const { isHistoryView } = useHashRouter()
  useVirtualKeyboard()
  useVisualViewportCssSyncOnFocus(Boolean(isMobile && !isHistoryView))

  if (isHistoryView) return <MobileHistory />

  return (
    <>
      <div className={`mobileLayoutRoot tiptap flex w-full flex-col ${deviceClass}`}>
        <div className="mobileLayoutMain flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mobilePadTitleShell bg-base-100 sticky top-0 z-20 w-full shrink-0">
            <MobilePadTitle />
          </div>
          <MobileLeftSidePanel />
          <MobileEditor />
          <EditFAB />
        </div>
        <div className="mobileToolbarBottom bg-base-100 z-20 w-full shrink-0">
          <ToolbarMobile />
        </div>
      </div>
      {/*
        Keep sheet UI out of the mobileLayoutRoot flex column. react-modal-sheet's iOS
        avoidKeyboard + closed-sheet chrome can still participate in flex layout and,
        after many keyboard cycles, leave dead space above the real visual viewport bottom.
      */}
      <BottomSheet />
    </>
  )
}

export default MobileLayout
