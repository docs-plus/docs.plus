import { Avatar } from '@components/ui/Avatar'
import { Icons } from '@icons'
import { memo, type ReactNode } from 'react'

import { displayName, isEveryone, type MentionPickerEntry } from './mentionTypes'

export type MentionSuggestionRowProps = {
  entry: MentionPickerEntry
  index: number
  optionId: string
  selected: boolean
  online: boolean
  onSelect: (index: number) => void
  onMouseEnter: (index: number) => void
}

export const MentionSuggestionRow = memo(function MentionSuggestionRow({
  entry,
  index,
  optionId,
  selected,
  online,
  onSelect,
  onMouseEnter
}: MentionSuggestionRowProps): ReactNode {
  const name = displayName(entry)
  const handle = `@${entry.username}`

  return (
    <div
      id={optionId}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      data-testid="mention-suggestion-row"
      data-mention-option-id={entry.id}
      onMouseEnter={() => onMouseEnter(index)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(index)}
      className={`hover:bg-base-200 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
        selected ? 'bg-base-200' : ''
      }`}>
      {isEveryone(entry) ? (
        <span
          className="bg-base-200 flex size-8 shrink-0 items-center justify-center rounded-full"
          aria-hidden>
          <Icons.share className="text-base-content/70 size-4" />
        </span>
      ) : (
        <Avatar
          id={entry.id}
          src={entry.avatar_url || ''}
          avatarUpdatedAt={entry.avatar_updated_at ?? null}
          alt={name}
          size="sm"
          displayPresence
          online={online}
          clickable={false}
          className="shrink-0"
        />
      )}
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="truncate font-medium">{name}</span>
        <span className="text-base-content/60 shrink-0 truncate text-sm">{handle}</span>
      </span>
    </div>
  )
})
