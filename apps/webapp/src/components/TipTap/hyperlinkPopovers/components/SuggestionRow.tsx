import { Icons } from '@components/icons/registry'
import { twMerge } from '@utils/twMerge'
import { memo, type ReactNode } from 'react'

import type { SuggestionRowProps } from '../types'

const ICON_SIZE = 16

const headingIndentPx = (level: number): number => Math.max(0, level - 1) * 12

/** `role="option"` (not `<button>`) — listbox children are excluded from Tab; focus stays in the combobox via `aria-activedescendant`. Memoized so URL keystrokes don't re-render every row. */
export const SuggestionRow = memo(function SuggestionRow({
  id,
  suggestion,
  selected,
  onPick,
  onMouseEnter,
  rowPadClass,
  rowInsetPx
}: SuggestionRowProps): ReactNode {
  const isHeading = suggestion.kind === 'heading'
  const indent = isHeading ? headingIndentPx(suggestion.level) : 0
  const archived = suggestion.kind === 'bookmark' && suggestion.archived

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      data-testid="hyperlink-suggestion-row"
      data-suggestion-kind={suggestion.kind}
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => {
        // Prevent the URL input from losing focus on row click. The
        // mousedown default would blur the input and tear down the
        // popover before onClick fires on desktop.
        e.preventDefault()
      }}
      onClick={() => onPick(suggestion)}
      className={twMerge(
        'hover:bg-base-200 flex min-h-11 w-full cursor-pointer items-center gap-2 py-2 text-left text-sm',
        rowPadClass,
        selected && 'bg-base-200'
      )}
      style={{ paddingLeft: `${rowInsetPx + indent}px` }}>
      <span className="text-base-content/70 shrink-0" aria-hidden>
        {isHeading ? <Icons.heading size={ICON_SIZE} /> : <Icons.bookmark size={ICON_SIZE} />}
      </span>
      {/* Archived dims by ink, not row opacity: opacity also sank the badge under 4.5:1. */}
      <span className={twMerge('flex-1 truncate', archived && 'text-base-content/70')}>
        {suggestion.title}
      </span>
      {archived && (
        <span className="badge badge-sm badge-soft shrink-0" aria-label="archived bookmark">
          Archived
        </span>
      )}
    </div>
  )
})
