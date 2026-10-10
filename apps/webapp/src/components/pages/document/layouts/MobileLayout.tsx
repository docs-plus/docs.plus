import { ComposerLinkDialogHost } from '@components/chatroom/components/MessageComposer/components/ComposerLinkDialog'
import ChatPane from '@components/pages/document/components/chat/ChatPane'
import EditFAB from '@components/pages/document/components/EditFAB'
import TocModal from '@components/pages/document/components/TocModal'
import { useHistoryHash } from '@components/pages/history/historyShareUrl'
import MobileHistory from '@components/pages/history/mobile/MobileHistory'
import FindBar from '@components/TipTap/find/FindBar'
import MobilePadTitle from '@components/TipTap/pad-title-section/MobilePadTitle'
import ToolbarMobile from '@components/TipTap/toolbar/mobile/ToolbarMobile'
import { ModalDrawer } from '@components/ui/ModalDrawer'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'
import { useVisualViewportCssSyncOnFocus } from '@hooks/useVisualViewportCssSyncOnFocus'
import { closeOpenChatRoom } from '@services/openHeadingChatroom'
import { useSheetStore, useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useEffect, useState } from 'react'

import MobileEditor from '../components/MobileEditor'
import SkipToPadMain from '../components/SkipToPadMain'

const MobileLeftSidePanel = () => {
  return (
    <ModalDrawer modalId="mobile_left_side_panel" width={80} ariaLabel="Table of contents">
      <TocModal />
    </ModalDrawer>
  )
}

const MobileLayout = () => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)
  const editor = useStore((state) => state.settings.editor.instance)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  const { isHistory } = useHistoryHash()
  // Fade the title in only on a return from history. At the S0→S1 swap the S0 header
  // already sits here, so a fade would blink it. This layout outlives the history swap.
  const [fadeInTitle, setFadeInTitle] = useState(false)
  if (isHistory && !fadeInTitle) setFadeInTitle(true)
  const closeSheet = useSheetStore((state) => state.closeSheet)
  useVirtualKeyboard()
  useVisualViewportCssSyncOnFocus(Boolean(isMobile && !isHistory))

  useEffect(() => {
    closeSheet()
    if (isHistory) closeOpenChatRoom()
  }, [isHistory, closeSheet])

  return (
    <>
      {isHistory ? (
        <MobileHistory />
      ) : (
        <>
          <div className={`mobileLayoutRoot tiptap flex w-full flex-col ${deviceClass}`}>
            <SkipToPadMain />
            <div className="mobileLayoutMain flex min-h-0 min-w-0 flex-1 flex-col">
              {/* Opacity only — no transforms next to the sticky/visualViewport machinery. */}
              <div
                className={twMerge(
                  'mobilePadTitleShell bg-base-100 sticky top-0 z-20 w-full shrink-0',
                  fadeInTitle && 'motion-safe:animate-[doc-content-in_220ms_ease-out_both]'
                )}>
                <MobilePadTitle />
              </div>
              {editor && <FindBar editor={editor} variant="mobile" />}
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
