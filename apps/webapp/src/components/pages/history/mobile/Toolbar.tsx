import {
  clearHistoryHash,
  copyHistoryVersionLinkToClipboard,
  copyVersionLinkTitle
} from '@components/pages/history/historyShareUrl'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Button from '@components/ui/Button'
import { useBottomSheet } from '@hooks/useBottomSheet'
import { Icons } from '@icons'
import { useStore } from '@stores'

import { HistoryRestoreModal } from '../components/HistoryRestoreModal'
import { countVersionsAfter, formatCompareRange, formatVersionDate } from '../helpers'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useHistoryCompare } from '../hooks/useHistoryCompare'
import { useVersionRestore } from '../hooks/useVersionRestore'

const ICON_SIZE = 20

const Toolbar = ({ onOpenCompareSheet }: { onOpenCompareSheet: () => void }) => {
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  const versionInfo = useGetVersionInfo()
  const { restoreOpen, setRestoreOpen, requestRestore, confirmRestore, restoring, canRestore } =
    useVersionRestore()
  const { compareMode, compareBaseItem, canCompare, exitCompare } = useHistoryCompare()
  const { close, activeSheet } = useBottomSheet()
  const compareSheetOpen = activeSheet === 'historyCompare'
  const compareRange =
    compareMode && compareBaseItem && activeHistory
      ? formatCompareRange(compareBaseItem.createdAt, activeHistory.createdAt)
      : null
  const copyLinkLabel = versionInfo ? copyVersionLinkTitle(versionInfo.createdAt) : null
  const restoreStamp = versionInfo ? formatVersionDate(versionInfo.createdAt) : null
  const restoreLabel = restoreStamp
    ? `Restore this version from ${restoreStamp.date} at ${restoreStamp.time}`
    : undefined

  const hideChanges = () => {
    exitCompare()
    if (compareSheetOpen) close()
  }

  return (
    <header className="bg-base-100 sticky top-0 left-0 z-30 w-full shrink-0">
      <div className="border-base-300 flex min-h-12 w-full items-center border-b px-2">
        <ToolbarButton
          className="shrink-0 touch-manipulation"
          onClick={() => clearHistoryHash()}
          aria-label="Back to Editor"
          tooltip="Back to the Editor"
          tooltipPlacement="right">
          <Icons.back size={ICON_SIZE} className="text-base-content/70 stroke-[1.75]" />
        </ToolbarButton>

        <div className="flex min-w-0 flex-1 items-center justify-center">
          {restoreStamp && (
            <div className="text-base-content/60 min-w-0 truncate text-center text-sm whitespace-nowrap">
              <span className="text-base-content font-medium">{restoreStamp.date}</span>
              <span className="ml-2"> {restoreStamp.time}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          {versionInfo && copyLinkLabel && (
            <ToolbarButton
              className="shrink-0 touch-manipulation"
              onClick={() => void copyHistoryVersionLinkToClipboard(versionInfo.version)}
              tooltip={copyLinkLabel}
              aria-label={copyLinkLabel}>
              <Icons.link size={ICON_SIZE} className="text-base-content/70 stroke-[1.75]" />
            </ToolbarButton>
          )}
          <ToolbarButton
            className="shrink-0 touch-manipulation"
            onClick={() => {
              if (compareMode) {
                hideChanges()
                return
              }
              onOpenCompareSheet()
            }}
            isActive={compareMode}
            disabled={!canCompare && !compareMode}
            aria-label={compareMode ? 'Hide changes' : 'Show what changed'}
            tooltip={
              compareMode
                ? 'Hide changes'
                : 'Show what changed in this version. Edits that only changed formatting show nothing, and very large differences are shown as one block.'
            }>
            <Icons.splitVertical
              size={ICON_SIZE}
              className={compareMode ? 'stroke-[1.75]' : 'text-base-content/70 stroke-[1.75]'}
            />
          </ToolbarButton>

          {compareSheetOpen ? (
            <button
              type="button"
              disabled
              aria-label="Open version history"
              className="btn btn-sm btn-ghost btn-square shrink-0 touch-manipulation">
              <Icons.menu size={ICON_SIZE} className="text-base-content/70 stroke-[1.75]" />
            </button>
          ) : (
            <label
              htmlFor="mobile_history_panel"
              aria-label="Open version history"
              className="btn btn-sm btn-ghost btn-square drawer-button shrink-0 touch-manipulation">
              <Icons.menu size={ICON_SIZE} className="text-base-content/70 stroke-[1.75]" />
            </label>
          )}
        </div>
      </div>

      {versionInfo && !versionInfo.isLatestVersion && restoreLabel && (
        <div className="border-base-300 flex items-center justify-center border-b px-2 py-1.5">
          <Button
            variant="primary"
            size="sm"
            loading={restoring}
            loadingText="Restoring…"
            disabled={!canRestore}
            onClick={requestRestore}
            aria-label={restoreLabel}
            tooltip={restoreLabel}
            tooltipPlacement="bottom">
            Restore this version
          </Button>
        </div>
      )}

      {compareRange && (
        <div className="border-base-300 flex min-w-0 items-center gap-2 border-b px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-start truncate font-normal"
            onClick={onOpenCompareSheet}
            aria-label={compareRange.ariaLabel}>
            <span className="text-base-content font-medium">{compareRange.fromLabel}</span>
            <span aria-hidden className="text-base-content/50 mx-1.5">
              →
            </span>
            <span className="text-base-content font-medium">{compareRange.toLabel}</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0"
            onClick={hideChanges}
            aria-label="Hide changes">
            Hide changes
          </Button>
        </div>
      )}

      <HistoryRestoreModal
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        createdAt={activeHistory?.createdAt}
        newerCount={countVersionsAfter(historyList, activeHistory?.version)}
        onConfirm={confirmRestore}
      />
    </header>
  )
}

export default Toolbar
