import { clearHistoryHash } from '@components/pages/history/historyShareUrl'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useStore } from '@stores'

import { HistoryToolbarVersionBlock } from '../components/HistoryToolbarVersionBlock'
import { formatCompareRange } from '../helpers'
import { useCopyHistoryVersionLink } from '../hooks/useCopyHistoryVersionLink'
import { useGetVersionInfo } from '../hooks/useGetVersionInfo'
import { useHistoryCompare } from '../hooks/useHistoryCompare'
import { useVersionRestore } from '../hooks/useVersionRestore'

const ICON_SIZE = 16

const Toolbar = () => {
  const activeHistory = useStore((state) => state.activeHistory)
  const versionInfo = useGetVersionInfo()
  const { requestRestore, restoring, canRestore, allowRestore } = useVersionRestore()
  const { compareMode, compareBaseItem, canCompare, toggleCompare, exitCompare } =
    useHistoryCompare()
  const {
    copy: copyVersionLink,
    copied,
    label: copyLinkLabel
  } = useCopyHistoryVersionLink(versionInfo?.version, versionInfo?.createdAt)
  const compareRange =
    compareMode && compareBaseItem && activeHistory
      ? formatCompareRange(compareBaseItem.createdAt, activeHistory.createdAt)
      : null

  return (
    <>
      <header className="border-base-300 bg-base-100 flex h-14 shrink-0 items-center border-b px-3">
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
            allowRestore={allowRestore}
          />
        </div>
      </header>

      <div className="tiptap__toolbar border-base-300 bg-base-100 flex min-w-0 flex-row items-center justify-between gap-0.5 border-b px-3 py-1.5">
        <div className="flex items-center gap-0.5">
          <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)" aria-label="Print">
            <Icons.print size={ICON_SIZE} />
          </ToolbarButton>
          {versionInfo && (
            <ToolbarButton
              onClick={() => void copyVersionLink()}
              tooltip={copyLinkLabel}
              aria-label={copyLinkLabel}>
              <span className={`swap ${copied ? 'swap-active' : ''}`} aria-hidden>
                <Icons.check size={ICON_SIZE} className="swap-on text-success stroke-[1.75]" />
                <Icons.link size={ICON_SIZE} className="swap-off stroke-[1.75]" />
              </span>
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
            {/* `.is-active` paints text-primary, which is 3.95:1 on its own tint at 12px. */}
            <span className={compareMode ? 'text-[var(--primary-ink)]' : undefined}>Changes</span>
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
    </>
  )
}

export default Toolbar
