import { clearHistoryHash } from '@components/pages/history/historyShareUrl'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { Icons } from '@icons'
import { useStore } from '@stores'

import { HistoryRestoreModal } from '../components/HistoryRestoreModal'
import { HistoryToolbarVersionBlock } from '../components/HistoryToolbarVersionBlock'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useVersionRestore } from '../hooks/useVersionRestore'

const Toolbar = () => {
  const activeHistory = useStore((state) => state.activeHistory)
  const versionInfo = useGetVersionInfo()
  const { restoreOpen, setRestoreOpen, requestRestore, confirmRestore } = useVersionRestore()

  return (
    <header className="bg-base-100 sticky top-0 left-0 z-30 w-full shrink-0">
      <div className="border-base-300 flex min-h-12 w-full flex-col border-b px-2 py-2">
        <div className="flex w-full items-center justify-between gap-2">
          <ToolbarButton
            onClick={() => clearHistoryHash()}
            aria-label="Back to Editor"
            tooltip="Back to the Editor"
            tooltipPlacement="right">
            <Icons.back size={24} />
          </ToolbarButton>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1">
            <HistoryToolbarVersionBlock
              variant="mobile"
              versionInfo={versionInfo}
              onRequestRestore={requestRestore}
            />
          </div>

          <label
            htmlFor="mobile_history_panel"
            aria-label="Open version history"
            className="btn btn-ghost btn-square drawer-button min-h-11 min-w-11 shrink-0">
            <Icons.menu size={24} />
          </label>
        </div>
      </div>

      <HistoryRestoreModal
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        version={activeHistory?.version}
        onConfirm={confirmRestore}
      />
    </header>
  )
}

export default Toolbar
