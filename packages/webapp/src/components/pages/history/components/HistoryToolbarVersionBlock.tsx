import Button from '@components/ui/Button'

import { formatVersionDate } from '../helpers'
import type { HistoryToolbarVersion } from '../hooks/useGetVersionInfo'

type Props = {
  versionInfo: HistoryToolbarVersion | null
  onRequestRestore: () => void
  variant: 'desktop' | 'mobile'
}

/**
 * Shared restore + timestamp block for history toolbars (desktop row vs mobile compact).
 */
export function HistoryToolbarVersionBlock({ versionInfo, onRequestRestore, variant }: Props) {
  if (!versionInfo) return null

  const { date, time } = formatVersionDate(versionInfo.createdAt)
  const showRestore = !versionInfo.isLatestVersion

  if (variant === 'mobile') {
    return (
      <>
        {showRestore && (
          <Button
            variant="primary"
            onClick={onRequestRestore}
            aria-label="Restore this version"
            tooltip={`Restore document to version ${versionInfo.version}`}
            tooltipPlacement="bottom">
            Restore this version
          </Button>
        )}
        <div className="text-center text-sm">
          <span className="font-medium">{date}</span>
          <br />
          <span className="text-base-content/60">{time}</span>
        </div>
      </>
    )
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-3">
      {showRestore && (
        <Button
          variant="primary"
          className="font-normal"
          onClick={onRequestRestore}
          aria-label="Restore this version"
          tooltip={`Restore document to version ${versionInfo.version}`}
          tooltipPlacement="bottom">
          Restore this version
        </Button>
      )}
      <div className="text-sm whitespace-nowrap">
        <span className="font-medium">{date}</span>
        <span className="text-base-content/60 ml-2">{time}</span>
      </div>
    </div>
  )
}
