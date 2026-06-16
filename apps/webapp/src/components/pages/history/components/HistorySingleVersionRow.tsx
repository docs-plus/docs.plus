import Button from '@components/ui/Button'
import type { HistoryItem } from '@types'
import { twMerge } from 'tailwind-merge'

import { CopyVersionLinkButton, HistoryTimelineDot, VersionSummary } from './HistorySidebarRowParts'

export function HistorySingleVersionRow({
  version,
  activeVersion,
  latestVersion,
  onSelectVersion
}: {
  version: HistoryItem
  activeVersion: number
  latestVersion: number
  onSelectVersion: (version: number) => void
}) {
  const isCurrentActive = version.version === activeVersion
  const isLatest = version.version === latestVersion

  return (
    <div
      className={twMerge(
        'group rounded-box flex min-h-11 items-stretch overflow-hidden border transition-colors duration-150',
        isCurrentActive
          ? 'border-primary/50 bg-primary/10'
          : 'border-base-300 bg-base-100 hover:border-base-content/20 hover:bg-base-200/60'
      )}
      data-testid={`history-version-row-${version.version}`}>
      <Button
        onClick={() => onSelectVersion(version.version)}
        variant="ghost"
        className="h-auto min-h-11 min-w-0 flex-1 items-center justify-start gap-2.5 rounded-none border-0 px-3 py-2.5 text-left shadow-none hover:bg-transparent active:bg-transparent">
        <HistoryTimelineDot active={isCurrentActive} className="size-2 shrink-0" />
        <VersionSummary
          version={version}
          active={isCurrentActive}
          showLatest={isLatest}
          titleClassName="text-sm"
        />
      </Button>
      <CopyVersionLinkButton version={version.version} isActiveRow={isCurrentActive} inlineInRow />
    </div>
  )
}
