import { ComposerLinkDialogHost } from '@components/chatroom/components/MessageComposer/components/ComposerLinkDialog'
import ChatPane from '@components/pages/document/components/chat/ChatPane'
import EditFAB from '@components/pages/document/components/EditFAB'
import TocModal from '@components/pages/document/components/TocModal'
import MobileHistory from '@components/pages/history/mobile/MobileHistory'
import MobilePadTitle from '@components/TipTap/pad-title-section/MobilePadTitle'
import ToolbarMobile from '@components/TipTap/toolbar/mobile/ToolbarMobile'
import { ModalDrawer } from '@components/ui/ModalDrawer'
import { useHashRouter } from '@hooks/useHashRouter'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'
import { useVisualViewportCssSyncOnFocus } from '@hooks/useVisualViewportCssSyncOnFocus'
import { destroyChatRoomForHistory } from '@services/openHeadingChatroom'
import { useSheetStore, useStore } from '@stores'
import { useEffect } from 'react'

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
  const closeSheet = useSheetStore((state) => state.closeSheet)
  useVirtualKeyboard()
  useVisualViewportCssSyncOnFocus(Boolean(isMobile && !isHistoryView))

  useEffect(() => {
    closeSheet()
    if (isHistoryView) destroyChatRoomForHistory()
  }, [isHistoryView, closeSheet])

  return (
    <>
      {isHistoryView ? (
        <MobileHistory />
      ) : (
        <>
          <div className={`mobileLayoutRoot tiptap flex w-full flex-col ${deviceClass}`}>
            <div className="mobileLayoutMain flex min-h-0 min-w-0 flex-1 flex-col">
              {/* Opacity only — no transforms next to the sticky/visualViewport machinery. */}
              <div className="mobilePadTitleShell bg-base-100 sticky top-0 z-20 w-full shrink-0 motion-safe:animate-[doc-content-in_220ms_ease-out_both]">
                <MobilePadTitle />
              </div>
              <MobileLeftSidePanel />
              <MobileEditor />
              <EditFAB />
            </div>
            <div className="mobileToolbarBottom bg-base-100 z-20 w-full shrink-0">
              <ToolbarMobile />
            </div>
            {/*
              Last child on purpose: the pane reserves real height so the document can scroll
              to its end above it, and DOM order keeps the pad toolbar from ever rendering
              below the chat during the open transition.
            */}
            <ChatPane />
          </div>
          <ComposerLinkDialogHost />
        </>
      )}
    </>
  )
}

export default MobileLayout
