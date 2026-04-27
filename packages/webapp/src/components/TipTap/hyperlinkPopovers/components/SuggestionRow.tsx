import { Icons } from '@components/icons/registry'
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
  onMouseEnter
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
        // Prevent the URL input from losing focus on row click; the
        // mousedown default would blur the input and tear down the
        // popover before onClick fires on desktop.
        e.preventDefault()
      }}
      onClick={() => onPick(suggestion)}
      className={`hover:bg-base-200 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded px-2 py-2 text-left text-sm ${
        selected ? 'bg-base-200' : ''
      } ${archived ? 'opacity-60' : ''}`}
      style={{ paddingLeft: `${8 + indent}px` }}>
      <span className="text-base-content/70 shrink-0" aria-hidden>
        {isHeading ? <Icons.heading size={ICON_SIZE} /> : <Icons.bookmark size={ICON_SIZE} />}
      </span>
      <span className="flex-1 truncate">{suggestion.title}</span>
      {archived && (
        <span
          className="bg-base-300 text-base-content/70 shrink-0 rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase"
          aria-label="archived bookmark">
          Archived
        </span>
      )}
    </div>
  )
})
