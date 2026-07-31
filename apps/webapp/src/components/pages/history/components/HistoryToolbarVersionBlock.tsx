import Button from '@components/ui/Button'
import { Icons } from '@icons'

import { formatVersionDate } from '../helpers'
import { copyHistoryVersionLinkToClipboard, copyVersionLinkTitle } from '../historyShareUrl'
import type { HistoryToolbarVersion } from '../hooks/useGetVersionInfo'

type Props = {
  versionInfo: HistoryToolbarVersion | null
  onRequestRestore: () => void
  variant: 'desktop' | 'mobile'
  restoring?: boolean
  /** False while a version watch is in flight — `versionInfo` still names the old one. */
  canRestore?: boolean
}

export function HistoryToolbarVersionBlock({
  versionInfo,
  onRequestRestore,
  variant,
  restoring = false,
  canRestore = true
}: Props) {
  if (!versionInfo) return null

  const { date, time } = formatVersionDate(versionInfo.createdAt)
  const showRestore = !versionInfo.isLatestVersion
  // The date and time is what the sidebar shows; a version number appears nowhere a reader can see.
  const restoreLabel = `Restore this version from ${date} at ${time}`

  const onCopyLink = () => {
    void copyHistoryVersionLinkToClipboard(versionInfo.version)
  }
  const copyTitle = copyVersionLinkTitle(versionInfo.version)

  if (variant === 'mobile') {
    return (
      <>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!showRestore && (
            <span className="text-base-content/60 text-sm">This is the current version.</span>
          )}
          {showRestore && (
            <Button
              variant="primary"
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
          <Button
            variant="ghost"
            shape="square"
            className="min-h-11 min-w-11 shrink-0"
            onClick={onCopyLink}
            aria-label={copyTitle}
            tooltip={copyTitle}
            tooltipPlacement="bottom">
            <Icons.link size={22} />
          </Button>
        </div>
        <div className="text-center text-sm">
          <span className="font-medium">{date}</span>
          <br />
          <span className="text-base-content/60">{time}</span>
        </div>
      </>
    )
  }

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
