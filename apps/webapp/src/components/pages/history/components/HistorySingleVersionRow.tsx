import type { HistoryItem } from '@types'
import { twMerge } from '@utils/twMerge'

import { CopyVersionLinkButton, HistoryTimelineDot, VersionSummary } from './HistorySidebarRowParts'

export function HistorySingleVersionRow({
  version,
  activeVersion,
  latestVersion,
  onSelectVersion,
  comparePick = false
}: {
  version: HistoryItem
  activeVersion: number
  latestVersion: number
  onSelectVersion: (version: number) => void
  comparePick?: boolean
}) {
  const isCurrentActive = version.version === activeVersion
  const isLatest = version.version === latestVersion
  const pickBlocked = comparePick && isCurrentActive

  return (
    <div
      className={twMerge(
        'group rounded-box flex min-h-11 items-stretch overflow-hidden border transition-colors duration-150',
        isCurrentActive
          ? 'border-primary/50 bg-primary/10'
          : 'border-base-300 bg-base-100 hover:border-base-content/20 hover:bg-base-200'
      )}
      data-testid={`history-version-row-${version.version}`}>
      {/* A plain button with an inset ring: the row clips overflow, so a btn outline would not show. */}
      <button
        type="button"
        onClick={() => onSelectVersion(version.version)}
        disabled={pickBlocked}
        aria-label={pickBlocked ? 'This is the version you are viewing' : undefined}
        className="rounded-box focus-visible:ring-primary flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-start gap-2.5 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-40">
        <HistoryTimelineDot active={isCurrentActive} className="size-2 shrink-0" />
        <VersionSummary
          version={version}
          active={isCurrentActive}
          showLatest={isLatest}
          titleClassName="text-sm"
        />
      </button>
      {!comparePick && (
        <CopyVersionLinkButton
          version={version.version}
          createdAt={version.createdAt}
          isActiveRow={isCurrentActive}
          className="rounded-box"
        />
      )}
    </div>
  )
}
