import {
  clearHistoryHash,
  copyHistoryVersionLinkToClipboard,
  copyVersionLinkTitle
} from '@components/pages/history/historyShareUrl'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useStore } from '@stores'

import { HistoryRestoreModal } from '../components/HistoryRestoreModal'
import { HistoryToolbarVersionBlock } from '../components/HistoryToolbarVersionBlock'
import { countVersionsAfter, formatCompareRange } from '../helpers'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useHistoryCompare } from '../hooks/useHistoryCompare'
import { useVersionRestore } from '../hooks/useVersionRestore'

const ICON_SIZE = 16

const Toolbar = () => {
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  const versionInfo = useGetVersionInfo()
  const { restoreOpen, setRestoreOpen, requestRestore, confirmRestore, restoring, canRestore } =
    useVersionRestore()
  const { compareMode, compareBaseItem, canCompare, toggleCompare, exitCompare } =
    useHistoryCompare()
  const copyLinkLabel = versionInfo ? copyVersionLinkTitle(versionInfo.createdAt) : null
  const compareRange =
    compareMode && compareBaseItem && activeHistory
      ? formatCompareRange(compareBaseItem.createdAt, activeHistory.createdAt)
      : null

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
            versionInfo={versionInfo}
            onRequestRestore={requestRestore}
            restoring={restoring}
            canRestore={canRestore}
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
          <ToolbarButton
            shape={null}
            className="gap-1 px-2"
            onClick={toggleCompare}
            isActive={compareMode}
            disabled={!canCompare && !compareMode}
            aria-label={compareMode ? 'Hide changes' : 'Show what changed'}
            tooltip={
              compareMode
                ? 'Hide changes'
                : 'Show what changed in this version. Edits that only changed formatting show nothing, and very large differences are shown as one block.'
            }>
            <Icons.splitVertical size={ICON_SIZE} />
            <span>Changes</span>
          </ToolbarButton>
        </div>

        {compareRange && (
          <div className="text-base-content/60 flex min-w-0 shrink items-center gap-2 text-sm">
            <span
              className="min-w-0 truncate whitespace-nowrap tabular-nums"
              aria-label={compareRange.ariaLabel}>
              <span className="text-base-content font-medium">{compareRange.fromLabel}</span>
              <span aria-hidden className="text-base-content/50 mx-1.5">
                →
              </span>
              <span className="text-base-content font-medium">{compareRange.toLabel}</span>
            </span>
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0"
              onClick={exitCompare}
              aria-label="Hide changes"
              tooltip="Hide changes">
              Hide changes
            </Button>
          </div>
        )}
      </div>

      <HistoryRestoreModal
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        createdAt={activeHistory?.createdAt}
        newerCount={countVersionsAfter(historyList, activeHistory?.version)}
        onConfirm={confirmRestore}
      />
    </>
  )
}

export default Toolbar
