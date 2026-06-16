import {
  clearHistoryHash,
  copyHistoryVersionLinkToClipboard,
  copyVersionLinkTitle
} from '@components/pages/history/historyShareUrl'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { Icons } from '@icons'
import { useStore } from '@stores'

import { HistoryRestoreModal } from '../components/HistoryRestoreModal'
import { HistoryToolbarVersionBlock } from '../components/HistoryToolbarVersionBlock'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useVersionRestore } from '../hooks/useVersionRestore'

const ICON_SIZE = 16

const Toolbar = () => {
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  const versionInfo = useGetVersionInfo()
  const { restoreOpen, setRestoreOpen, requestRestore, confirmRestore } = useVersionRestore()
  const copyLinkLabel = versionInfo ? copyVersionLinkTitle(versionInfo.version) : null

  return (
    <>
      <header className="border-base-300 bg-base-100 flex min-h-12 shrink-0 items-center border-b px-3 py-2">
        <ToolbarButton
          onClick={() => clearHistoryHash()}
          aria-label="Back to Editor"
          tooltip="Back to the Editor"
          tooltipPlacement="right">
          <Icons.back size={ICON_SIZE} />
        </ToolbarButton>
        <div className="ml-auto flex min-w-0 items-center justify-end">
          <HistoryToolbarVersionBlock
            variant="desktop"
            versionInfo={versionInfo}
            onRequestRestore={requestRestore}
          />
        </div>
      </header>

      <div className="tiptap__toolbar border-base-300 bg-base-100 flex min-w-0 flex-row items-center justify-between gap-0.5 border-b px-3 py-1.5">
        <div className="flex items-center gap-0.5">
          <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)" aria-label="Print">
            <Icons.print size={ICON_SIZE} />
          </ToolbarButton>
          {versionInfo && copyLinkLabel && (
            <ToolbarButton
              onClick={() => void copyHistoryVersionLinkToClipboard(versionInfo.version)}
              tooltip={copyLinkLabel}
              aria-label={copyLinkLabel}>
              <Icons.link size={ICON_SIZE} />
            </ToolbarButton>
          )}
        </div>

        {activeHistory && (
          <div className="text-base-content/60 shrink-0 text-sm">
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
    </>
  )
}

export default Toolbar
