import { Icons } from '@components/icons/registry'
import type { ReactNode } from 'react'

import type { HyperlinkSuggestionsProps } from '../types'
import { SuggestionRow } from './SuggestionRow'

export function HyperlinkSuggestions({
  panel,
  headings,
  bookmarks,
  highlightIndex,
  isLoading,
  onPick,
  onExpand,
  onBack,
  onRowHover,
  rowIdPrefix
}: HyperlinkSuggestionsProps): ReactNode {
  if (panel === 'collapsed') {
    // Bleed `-mx-2 -mb-2` cancels the parent popover's `p-2` so the divider
    // and hover bg span popover-edge-to-edge, giving the expander a "drawer
    // pull" feel that matches the popover's bottom rounding (`rounded-b-lg`).
    return (
      <button
        type="button"
        onClick={onExpand}
        data-testid="hyperlink-suggestions-expand"
        className="border-base-300 hover:bg-base-200 text-base-content/80 -mx-2 -mb-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-b-lg border-t px-3 py-2 text-sm transition-colors">
        <span>Browse headings &amp; bookmarks</span>
        <Icons.chevronRight size={16} className="opacity-60" aria-hidden />
      </button>
    )
  }

  const totalRows = headings.length + bookmarks.length

  return (
    <div data-testid="hyperlink-suggestions">
      {panel === 'searching' && onBack && (
        <button
          type="button"
          onClick={onBack}
          data-testid="hyperlink-suggestions-back"
          className="text-base-content/70 hover:bg-base-200 mb-1 flex items-center gap-1 rounded px-2 py-1.5 text-xs transition-colors">
          <Icons.chevronLeft size={16} aria-hidden />
          <span>Back</span>
        </button>
      )}

      {/* Live region: announces "5 results" / "no results" / "loading" so screen-reader users get feedback as the filter narrows. */}
      <div role="status" aria-live="polite" className="sr-only">
        {isLoading
          ? 'Loading suggestions'
          : totalRows === 0
            ? 'No matching suggestions'
            : `${totalRows} ${totalRows === 1 ? 'suggestion' : 'suggestions'}`}
      </div>

      <div
        role="listbox"
        id={`${rowIdPrefix}-listbox`}
        className="max-h-72 overflow-y-auto"
        aria-label="Link suggestions">
        {headings.length > 0 && (
          <Section label="Headings">
            {headings.map((h, i) => {
              const flatIndex = i
              const id = `${rowIdPrefix}-row-${flatIndex}`
              return (
                <SuggestionRow
                  key={`h-${h.id}`}
                  id={id}
                  suggestion={h}
                  selected={highlightIndex === flatIndex}
                  onPick={onPick}
                  onMouseEnter={() => onRowHover(flatIndex)}
                />
              )
            })}
          </Section>
        )}

        {bookmarks.length > 0 && (
          <Section label="Bookmarks">
            {bookmarks.map((b, i) => {
              const flatIndex = headings.length + i
              const id = `${rowIdPrefix}-row-${flatIndex}`
              return (
                <SuggestionRow
                  key={`b-${b.id}`}
                  id={id}
                  suggestion={b}
                  selected={highlightIndex === flatIndex}
                  onPick={onPick}
                  onMouseEnter={() => onRowHover(flatIndex)}
                />
              )
            })}
          </Section>
        )}

        {!isLoading && totalRows === 0 && (
          <div className="text-base-content/60 px-2 py-3 text-sm">
            No matches. Try a shorter or different query.
          </div>
        )}

        {isLoading && totalRows === 0 && (
          <div className="text-base-content/60 animate-pulse px-2 py-3 text-sm">Loading…</div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div role="group" aria-label={label} className="mb-1">
      <div
        className="text-base-content/60 px-2 py-1 text-xs font-semibold tracking-wide uppercase"
        aria-hidden>
        {label}
      </div>
      {children}
    </div>
  )
}
