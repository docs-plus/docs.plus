import Button from '@components/ui/Button'
import { useStore } from '@stores'

import { formatVersionDate } from '../helpers'
import { useHistoryHash } from '../historyShareUrl'
import type { HistoryToolbarVersion } from '../hooks/useGetVersionInfo'

type Props = {
  versionInfo: HistoryToolbarVersion | null
  onRequestRestore: () => void
  restoring?: boolean
  /** False while a version watch is in flight — `versionInfo` still names the old one. */
  canRestore?: boolean
  /** Signed-in writer only. Visitors never see Restore. */
  allowRestore?: boolean
}

export function HistoryToolbarVersionBlock({
  versionInfo,
  onRequestRestore,
  restoring = false,
  canRestore = false,
  allowRestore = false
}: Props) {
  const { version: linkedVersion } = useHistoryHash()
  const loading = useStore((state) => state.loadingHistory)

  if (!versionInfo) {
    if (!loading) return null
    // A plain first load opens the latest version and its note. A version link opens
    // an older one, which shows Restore to a writer and nothing to a visitor.
    return (
      <div aria-hidden className="flex items-center justify-end gap-2">
        {linkedVersion == null ? (
          <div className="flex h-5 items-center">
            <div className="skeleton h-3.5 w-44" />
          </div>
        ) : (
          allowRestore && <div className="skeleton rounded-field h-8 w-40" />
        )}
        <div className="flex h-5 items-center">
          <div className="skeleton h-3.5 w-32" />
        </div>
      </div>
    )
  }

  const { date, time } = formatVersionDate(versionInfo.createdAt)
  const showRestore = allowRestore && !versionInfo.isLatestVersion
  // The date and time is what the sidebar shows; a version number appears nowhere a reader can see.
  const restoreLabel = `Restore this version from ${date} at ${time}`

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      {versionInfo.isLatestVersion && (
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
