import { Avatar } from '@components/ui/Avatar'
import { AvatarStack } from '@components/ui/AvatarStack'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useStore } from '@stores'
import type { HistoryItem, HistoryProfile, HistoryProfileMap, VersionTrigger } from '@types'
import { resolveDisplayName } from '@utils/avatarFace'
import { twMerge } from '@utils/twMerge'
import { useMemo } from 'react'

import { formatRelativeTime, formatTime } from '../helpers'
import { useCopyHistoryVersionLink } from '../hooks/useCopyHistoryVersionLink'

export function CopyVersionLinkButton({
  version,
  createdAt,
  isActiveRow,
  className
}: {
  version: number
  createdAt: string
  isActiveRow: boolean
  className?: string
}) {
  const { copy, copied, label } = useCopyHistoryVersionLink(version, createdAt)
  return (
    <Button
      type="button"
      variant="ghost"
      shape="square"
      size="sm"
      iconSize={16}
      className={twMerge(
        'shrink-0 border-0 bg-transparent shadow-none active:bg-transparent',
        'min-h-10 min-w-10 hover:bg-transparent md:min-h-9 md:min-w-9',
        'focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
        isActiveRow ? 'text-primary' : 'text-base-content/70 hover:text-base-content',
        'transition-opacity duration-150',
        isActiveRow
          ? 'opacity-100'
          : 'opacity-0 max-md:opacity-100 md:group-hover:opacity-100 md:focus-visible:opacity-100',
        className
      )}
      aria-label={label}
      tooltip={label}
      tooltipPlacement="left"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        void copy()
      }}>
      <span className={`swap ${copied ? 'swap-active' : ''}`} aria-hidden>
        <Icons.check size={16} className="swap-on stroke-[1.75] text-[var(--success-ink)]" />
        <Icons.link size={16} className="swap-off stroke-[1.75]" />
      </span>
    </Button>
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
  mcp: 'Connected app',
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

function peopleFromItem(item: HistoryItem, profiles: HistoryProfileMap): HistoryProfile[] {
  const contributors = (item.contributors ?? [])
    .map((id) => profiles[id])
    .filter((profile): profile is HistoryProfile => Boolean(profile))
  if (contributors.length > 0) return contributors
  const actor = item.triggeredBy ? profiles[item.triggeredBy] : undefined
  return actor ? [actor] : []
}

/** Unique resolved faces, first-seen order. Never invents a face from a bare id. */
export function peopleFromHistoryItems(
  items: HistoryItem[],
  profiles: HistoryProfileMap
): HistoryProfile[] {
  const seen = new Set<string>()
  const people: HistoryProfile[] = []
  for (const item of items) {
    for (const person of peopleFromItem(item, profiles)) {
      if (seen.has(person.id)) continue
      seen.add(person.id)
      people.push(person)
    }
  }
  return people
}

export function PeopleAttribution({
  people,
  inline,
  showName = true
}: {
  people: HistoryProfile[]
  inline?: boolean
  showName?: boolean
}) {
  if (people.length === 0) return null
  const solo = people.length === 1 ? people[0] : null
  const soloName = solo ? (resolveDisplayName(solo) ?? 'Anonymous') : null

  return (
    <span className={twMerge('flex min-w-0 items-center gap-1.5', inline ? 'min-w-0' : 'mt-1')}>
      {solo ? (
        <Avatar
          face={solo}
          size="xs"
          clickable={false}
          className="shrink-0"
          tooltip={showName ? undefined : (soloName ?? undefined)}
          tooltipPlacement="left"
        />
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
      {solo && showName && (
        <span className="text-base-content/70 truncate text-xs">{soloName}</span>
      )}
    </span>
  )
}

/**
 * Resolves ids through the profile map. Renders nothing when none resolve, because
 * `Avatar` invents a DiceBear face from a bare id and would name a person we cannot.
 */
export function VersionAttribution({ item, inline }: { item: HistoryItem; inline?: boolean }) {
  const profiles = useStore((state) => state.profiles)
  const people = useMemo(() => peopleFromHistoryItems([item], profiles), [item, profiles])
  return <PeopleAttribution people={people} inline={inline} />
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
            active ? 'text-[var(--primary-ink)]' : 'text-base-content'
          )}>
          {formatTime(version.createdAt)}
        </span>
        {showLatest && <HistoryLatestBadge />}
        <VersionTriggerBadge trigger={version.trigger} />
        <CompareBaseMarker version={version.version} />
      </div>
      <p className="text-base-content/60 mt-0.5 text-xs">{formatRelativeTime(version.createdAt)}</p>
      <VersionAttribution item={version} />
      {version.commitMessage && (
        <p className="text-base-content/70 mt-1 truncate text-sm">{version.commitMessage}</p>
      )}
    </div>
  )
}
