import { Icons } from '@components/icons/registry'
import { horizontalPadBleedClass, sheetBodyBleedClassName } from '@utils/sheetBodyPadding'
import type { ReactNode } from 'react'

import type {
  BookmarkSuggestion,
  HeadingSuggestion,
  HyperlinkSuggestionsProps,
  HyperlinkVariant
} from '../types'
import { SuggestionRow } from './SuggestionRow'

const SHELL_LAYOUT: Record<
  HyperlinkVariant,
  {
    listPad: string
    sectionPad: string
    rowPad: string
    rowInsetPx: number
    expanderClass: string
    panelClass: string | undefined
    /** Full-bleed against parent horizontal pad (see {@link sheetBodyPadClassName} in sheetBodyPadding). */
    bleedClass: string
  }
> = {
  desktop: {
    listPad: 'px-2',
    sectionPad: 'px-2 py-1',
    rowPad: 'px-2',
    rowInsetPx: 8,
    expanderClass:
      'border-base-300 hover:bg-base-200 text-base-content/80 -mb-2 flex w-full items-center justify-between rounded-b-field border-t px-3 py-2 text-sm transition-colors',
    panelClass: undefined,
    bleedClass: horizontalPadBleedClass(2)
  },
  mobile: {
    listPad: 'px-4',
    sectionPad: 'px-4 py-1',
    rowPad: 'px-4',
    rowInsetPx: 16,
    expanderClass:
      'border-base-300 hover:bg-base-200 text-base-content/80 flex w-full items-center justify-between border-t px-4 py-2.5 text-sm transition-colors',
    panelClass: 'border-base-300 border-t pt-2',
    bleedClass: sheetBodyBleedClassName
  }
}

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
  rowIdPrefix,
  variant = 'desktop'
}: HyperlinkSuggestionsProps): ReactNode {
  const layout = SHELL_LAYOUT[variant]

  if (panel === 'collapsed') {
    return (
      <div className={layout.bleedClass}>
        <button
          type="button"
          onClick={onExpand}
          data-testid="hyperlink-suggestions-expand"
          className={layout.expanderClass}>
          <span>Browse headings &amp; bookmarks</span>
          <Icons.chevronRight size={16} className="opacity-60" aria-hidden />
        </button>
      </div>
    )
  }

  const totalRows = headings.length + bookmarks.length
  const statusMessage = suggestionStatusMessage(isLoading, totalRows)

  const renderSection = (
    label: string,
    items: ReadonlyArray<HeadingSuggestion | BookmarkSuggestion>,
    indexOffset: number,
    keyPrefix: string
  ) => {
    if (items.length === 0) return null
    return (
      <Section label={label} labelClassName={layout.sectionPad}>
        {items.map((suggestion, i) => {
          const flatIndex = indexOffset + i
          return (
            <SuggestionRow
              key={`${keyPrefix}-${suggestion.id}`}
              id={`${rowIdPrefix}-row-${flatIndex}`}
              rowPadClass={layout.rowPad}
              rowInsetPx={layout.rowInsetPx}
              suggestion={suggestion}
              selected={highlightIndex === flatIndex}
              onPick={onPick}
              onMouseEnter={() => onRowHover(flatIndex)}
            />
          )
        })}
      </Section>
    )
  }

  return (
    <div className={layout.bleedClass}>
      <div data-testid="hyperlink-suggestions" className={layout.panelClass}>
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

        <div role="status" aria-live="polite" className="sr-only">
          {statusMessage}
        </div>

        <div
          role="listbox"
          id={`${rowIdPrefix}-listbox`}
          className="max-h-72 overflow-y-auto"
          aria-label="Link suggestions">
          {renderSection('Headings', headings, 0, 'h')}
          {renderSection('Bookmarks', bookmarks, headings.length, 'b')}

          {!isLoading && totalRows === 0 && (
            <div className={`text-base-content/60 py-3 text-sm ${layout.listPad}`}>
              No matches. Try a shorter or different query.
            </div>
          )}

          {isLoading && totalRows === 0 && (
            <div className={`text-base-content/60 animate-pulse py-3 text-sm ${layout.listPad}`}>
              Loading…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function suggestionStatusMessage(isLoading: boolean, totalRows: number): string {
  if (isLoading) return 'Loading suggestions'
  if (totalRows === 0) return 'No matching suggestions'
  return `${totalRows} ${totalRows === 1 ? 'suggestion' : 'suggestions'}`
}

function Section({
  label,
  labelClassName,
  children
}: {
  label: string
  labelClassName: string
  children: ReactNode
}): ReactNode {
  return (
    <div role="group" aria-label={label} className="mb-1">
      <div
        className={`text-base-content/60 text-xs font-semibold tracking-wide uppercase ${labelClassName}`}
        aria-hidden>
        {label}
      </div>
      {children}
    </div>
  )
}
