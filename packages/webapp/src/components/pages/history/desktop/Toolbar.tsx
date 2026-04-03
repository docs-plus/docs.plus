import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useStore } from '@stores'

import { HistoryRestoreModal } from '../components/HistoryRestoreModal'
import { HistoryToolbarVersionBlock } from '../components/HistoryToolbarVersionBlock'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useVersionRestore } from '../hooks/useVersionRestore'

const Toolbar = () => {
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  const versionInfo = useGetVersionInfo()
  const { restoreOpen, setRestoreOpen, requestRestore, confirmRestore } = useVersionRestore()

  return (
    <div className="toolbar bg-base-100 border-base-300 flex flex-col border-b">
      <div className="flex items-center gap-2 px-6 py-3">
        <Button
          shape="square"
          onClick={() => (window.location.hash = '')}
          aria-label="Back to Editor"
          startIcon={Icons.back}
          tooltip="Back to the Editor"
          tooltipPlacement="right"
        />
        <div className="flex min-w-0 flex-1 justify-end">
          <HistoryToolbarVersionBlock
            variant="desktop"
            versionInfo={versionInfo}
            onRequestRestore={requestRestore}
          />
        </div>
      </div>

      <div className="border-base-300 flex flex-row items-center justify-between gap-1 border-t px-6">
        <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)" aria-label="Print">
          <Icons.print size={16} />
        </ToolbarButton>

        {activeHistory && (
          <div className="text-base-content/60 text-sm">
            {`Version ${activeHistory.version} of ${historyList.length}`}
          </div>
        )}
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
