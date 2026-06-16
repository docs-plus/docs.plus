import { HistoryEditorContent } from '../HistoryEditorContent'
import HistorySidebar from '../HistorySidebar'
import { useHistoryEditor } from '../hooks/useHistoryEditor'
import Toolbar from './Toolbar'

const DesktopHistory = () => {
  useHistoryEditor()

  return (
    <div className="pad tiptap history_editor bg-base-200 flex h-full min-h-0 flex-col overflow-hidden motion-safe:animate-[doc-content-in_200ms_ease-out_both]">
      <div className="editor relative flex min-h-0 min-w-0 flex-1 flex-row justify-around align-top">
        <div className="mainWrapper relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden align-top">
          <Toolbar />
          <HistoryEditorContent variant="desktop" />
        </div>
        <HistorySidebar />
      </div>
    </div>
  )
}

export default DesktopHistory
