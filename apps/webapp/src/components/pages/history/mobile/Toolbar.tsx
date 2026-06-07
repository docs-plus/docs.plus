import { clearHistoryHash } from '@components/pages/history/historyShareUrl'
import Button from '@components/ui/Button'
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
    <div className="docTitle bg-base-100 sticky top-0 left-0 z-10 h-auto w-full">
      <div className="border-base-300 bg-base-100 relative z-10 flex min-h-12 w-full flex-col items-center border-b p-2">
        <div className="flex w-full flex-row items-center justify-between gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearHistoryHash()}
            aria-label="Back to Editor"
            startIcon={Icons.back}
            iconSize={22}
            tooltip="Back to the Editor"
            tooltipPlacement="right"
          />
          <div className="divider divider-horizontal m-0 h-10 p-0" />

          <HistoryToolbarVersionBlock
            variant="mobile"
            versionInfo={versionInfo}
            onRequestRestore={requestRestore}
          />

          <div className="divider divider-horizontal m-0 h-10 p-0" />
          <label
            htmlFor="mobile_history_panel"
            aria-label="Open version history"
            className="btn btn-ghost drawer-button shrink-0 px-2">
            <Icons.menu size={30} />
          </label>
        </div>
      </div>

      <HistoryRestoreModal
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        version={activeHistory?.version}
        onConfirm={confirmRestore}
      />
    </div>
  )
}

export default Toolbar
