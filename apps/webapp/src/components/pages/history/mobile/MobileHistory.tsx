import { ModalDrawer, useModalDrawerClose } from '@components/ui/ModalDrawer'
import { useVisualViewportCssSyncOnFocus } from '@hooks/useVisualViewportCssSyncOnFocus'

import { HistoryEditorContent } from '../HistoryEditorContent'
import HistorySidebar from '../HistorySidebar'
import { useHistoryEditor } from '../hooks/useHistoryEditor'
import Toolbar from './Toolbar'

function MobileHistorySidebar() {
  const close = useModalDrawerClose()
  return (
    <div className="bg-base-100 z-30 flex h-dvh max-h-dvh w-full max-w-[85%] min-w-[85%] flex-col overflow-hidden">
      <HistorySidebar
        className="bg-base-200 h-full w-full max-w-none border-l-0"
        onClose={close}
        variant="mobile"
      />
    </div>
  )
}

const MobileLeftSidePanel = () => (
  <ModalDrawer modalId="mobile_history_panel" position="right">
    <MobileHistorySidebar />
  </ModalDrawer>
)

const MobileHistory = () => {
  useHistoryEditor()
  useVisualViewportCssSyncOnFocus(true)

  return (
    <div className="mobileLayoutRoot pad tiptap history_editor border-base-300 flex min-h-0 w-full flex-col overflow-hidden border-solid">
      <Toolbar />
      <div className="min-h-0 flex-1 overflow-hidden">
        <HistoryEditorContent variant="mobile" />
      </div>
      <MobileLeftSidePanel />
    </div>
  )
}

export default MobileHistory
