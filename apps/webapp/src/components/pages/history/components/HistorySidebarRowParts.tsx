import {
  copyHistoryVersionLinkToClipboard,
  copyVersionLinkTitle
} from '@components/pages/history/historyShareUrl'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import type { HistoryItem } from '@types'
import { twMerge } from 'tailwind-merge'

import { formatRelativeTime, formatTime } from '../helpers'

export function CopyVersionLinkButton({
  version,
  isActiveRow,
  inlineInRow,
  className
}: {
  version: number
  isActiveRow: boolean
  inlineInRow?: boolean
  className?: string
}) {
  const copyTitle = copyVersionLinkTitle(version)
  return (
    <Button
      type="button"
      variant="ghost"
      shape="square"
      size="sm"
      iconSize={16}
      className={twMerge(
        'shrink-0 border-0 bg-transparent shadow-none active:bg-transparent',
        inlineInRow
          ? 'min-h-10 min-w-10 rounded-none hover:bg-transparent md:min-h-9 md:min-w-9'
          : 'rounded-selector hover:bg-base-300/35 min-h-[44px] min-w-[44px] md:min-h-8 md:min-w-8',
        isActiveRow ? 'text-primary' : 'text-base-content/45 hover:text-primary',
        'transition-opacity duration-150',
        isActiveRow
          ? 'opacity-100'
          : 'opacity-0 max-md:opacity-100 md:group-hover:opacity-100 md:focus-visible:opacity-100',
        className
      )}
      startIcon={Icons.link}
      aria-label={copyTitle}
      tooltip={copyTitle}
      tooltipPlacement="left"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        void copyHistoryVersionLinkToClipboard(version)
      }}
    />
  )
}

export function HistoryTimelineDot({ active, className }: { active: boolean; className?: string }) {
  return (
    <div
      className={twMerge(
        'rounded-full transition-colors',
        active ? 'bg-primary' : 'bg-base-300',
        className
      )}
    />
  )
}

export function HistoryLatestBadge({ compact }: { compact?: boolean }) {
  return (
    <span className={twMerge('badge badge-primary', compact ? 'badge-xs' : 'badge-sm')}>
      Latest
    </span>
  )
}

export function VersionSummary({
  version,
  active,
  showLatest,
  titleClassName
}: {
  version: HistoryItem
  active: boolean
  showLatest: boolean
  titleClassName: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span
          className={twMerge(
            titleClassName,
            'font-medium',
            active ? 'text-primary' : 'text-base-content/90'
          )}>
          {formatTime(version.createdAt)}
        </span>
        {showLatest && <HistoryLatestBadge />}
      </div>
      <p className={twMerge('text-base-content/50 mt-0.5 text-xs', active && 'text-primary/70')}>
        {formatRelativeTime(version.createdAt)}
      </p>
      {version.commitMessage && (
        <p className="text-base-content/70 mt-1 truncate text-sm">{version.commitMessage}</p>
      )}
    </div>
  )
}
