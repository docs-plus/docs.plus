import { filterTextMatchIndex } from '@utils/filterTextMatch'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export interface FilterSuggestion {
  id: string
  text: string
}

interface FilterSuggestionsProps {
  suggestions: FilterSuggestion[]
  query: string
  activeIndex: number
  listboxId: string
  optionId: (index: number) => string
  onPick: (suggestion: FilterSuggestion) => void
  onHover: (index: number) => void
}

// Bold the matched run so each row reads as "similar to what you typed".
function highlightMatch(text: string, query: string): ReactNode {
  const idx = filterTextMatchIndex(text, query)
  if (idx === -1) return text
  const q = query.trim()
  return (
    <>
      {text.slice(0, idx)}
      <mark className="text-primary bg-transparent font-semibold">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export function FilterSuggestions({
  suggestions,
  query,
  activeIndex,
  listboxId,
  optionId,
  onPick,
  onHover
}: FilterSuggestionsProps) {
  return (
    <div
      role="listbox"
      id={listboxId}
      aria-label="Matching headings"
      data-testid="filter-suggestions"
      className="border-base-300 bg-base-100 rounded-box max-h-64 overflow-y-auto border shadow-xl motion-safe:animate-[doc-content-in_140ms_ease-out_both]">
      {suggestions.length === 0 ? (
        <div className="text-base-content/50 px-3 py-2.5 text-sm">No matching headings</div>
      ) : (
        suggestions.map((s, i) => (
          <div
            key={s.id}
            id={optionId(i)}
            role="option"
            aria-selected={activeIndex === i}
            tabIndex={-1}
            data-testid="filter-suggestion-row"
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(s)}
            className={twMerge(
              'text-base-content flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
              activeIndex === i ? 'bg-base-200' : 'hover:bg-base-200/60'
            )}>
            <span className="truncate">{highlightMatch(s.text, query)}</span>
          </div>
        ))
      )}
    </div>
  )
}
