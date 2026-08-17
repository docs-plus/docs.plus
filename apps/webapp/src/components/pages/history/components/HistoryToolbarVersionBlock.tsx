import Button from '@components/ui/Button'

import { formatVersionDate } from '../helpers'
import type { HistoryToolbarVersion } from '../hooks/useGetVersionInfo'

type Props = {
  versionInfo: HistoryToolbarVersion | null
  onRequestRestore: () => void
  restoring?: boolean
  /** False while a version watch is in flight — `versionInfo` still names the old one. */
  canRestore?: boolean
}

export function HistoryToolbarVersionBlock({
  versionInfo,
  onRequestRestore,
  restoring = false,
  canRestore = true
}: Props) {
  if (!versionInfo) return null

  const { date, time } = formatVersionDate(versionInfo.createdAt)
  const showRestore = !versionInfo.isLatestVersion
  // The date and time is what the sidebar shows; a version number appears nowhere a reader can see.
  const restoreLabel = `Restore this version from ${date} at ${time}`

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      {!showRestore && (
        <span className="text-base-content/60 text-sm">This is the current version.</span>
      )}
      {showRestore && (
        <Button
          variant="primary"
          size="sm"
          className="font-normal"
          loading={restoring}
          loadingText="Restoring…"
          disabled={!canRestore}
          onClick={onRequestRestore}
          aria-label={restoreLabel}
          tooltip={restoreLabel}
          tooltipPlacement="bottom">
          Restore this version
        </Button>
      )}
      <div className="text-base-content/60 text-sm whitespace-nowrap">
        <span className="text-base-content font-medium">{date}</span>
        <span className="ml-2">{time}</span>
      </div>
    </div>
  )
}
