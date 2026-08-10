import {
  copyHistoryVersionLinkToClipboard,
  copyVersionLinkTitle
} from '@components/pages/history/historyShareUrl'
import { Avatar } from '@components/ui/Avatar'
import { AvatarStack } from '@components/ui/AvatarStack'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useStore } from '@stores'
import type { HistoryItem, HistoryProfile, VersionTrigger } from '@types'
import { resolveDisplayName } from '@utils/avatarFace'
import { useMemo } from 'react'
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
          : 'rounded-field hover:bg-base-300/35 min-h-[44px] min-w-[44px] md:min-h-8 md:min-w-8',
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

const MAX_ATTRIBUTION_FACES = 3

/**
 * Only non-`websocket` provenance earns a badge. `Partial` so an unmapped or
 * off-union value renders nothing rather than an empty pill.
 */
const VERSION_TRIGGER_LABELS: Partial<Record<VersionTrigger, string>> = {
  api: 'API',
  checkpoint: 'Checkpoint',
  revert: 'Restored',
  'revert-backup': 'Pre-restore',
  'schema-migration': 'Migration'
}

/** Marks which row is compare's A side; without it the reassign click is illegible. */
export function CompareBaseMarker({ version }: { version: number }) {
  const isBase = useStore((state) => state.compareBaseItem?.version === version)
  if (!isBase) return null
  return <span className="badge badge-ghost badge-xs shrink-0">A</span>
}

export function VersionTriggerBadge({ trigger }: { trigger?: VersionTrigger | null }) {
  const label = trigger ? VERSION_TRIGGER_LABELS[trigger] : undefined
  if (!label) return null
  return <span className="badge badge-ghost badge-xs shrink-0">{label}</span>
}

/**
 * Resolves ids through the profile map. Renders nothing when none resolve, because
 * `Avatar` invents a DiceBear face from a bare id and would name a person we cannot.
 */
export function VersionAttribution({
  item,
  inline,
  active
}: {
  item: HistoryItem
  inline?: boolean
  active?: boolean
}) {
  const profiles = useStore((state) => state.profiles)

  const people = useMemo(() => {
    const contributors = (item.contributors ?? [])
      .map((id) => profiles[id])
      .filter((profile): profile is HistoryProfile => Boolean(profile))
    if (contributors.length > 0) return contributors
    const actor = item.triggeredBy ? profiles[item.triggeredBy] : undefined
    return actor ? [actor] : []
  }, [item.contributors, item.triggeredBy, profiles])

  if (people.length === 0) return null
  const solo = people.length === 1 ? people[0] : null

  return (
    <span className={twMerge('flex min-w-0 items-center gap-1.5', inline ? 'min-w-0' : 'mt-1')}>
      {solo ? (
        <Avatar face={solo} size="xs" clickable={false} className="shrink-0" />
      ) : (
        <AvatarStack
          users={people}
          size="xs"
          surface="paper"
          maxDisplay={MAX_ATTRIBUTION_FACES}
          clickable={false}
          tooltipPlacement="left"
          className="shrink-0"
        />
      )}
      {solo && (
        <span
          className={twMerge(
            'truncate text-xs',
            active ? 'text-primary/70' : 'text-base-content/60'
          )}>
          {resolveDisplayName(solo) ?? 'Anonymous'}
        </span>
      )}
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
        <VersionTriggerBadge trigger={version.trigger} />
        <CompareBaseMarker version={version.version} />
      </div>
      <p className={twMerge('text-base-content/50 mt-0.5 text-xs', active && 'text-primary/70')}>
        {formatRelativeTime(version.createdAt)}
      </p>
      <VersionAttribution item={version} active={active} />
      {version.commitMessage && (
        <p className="text-base-content/70 mt-1 truncate text-sm">{version.commitMessage}</p>
      )}
    </div>
  )
}
