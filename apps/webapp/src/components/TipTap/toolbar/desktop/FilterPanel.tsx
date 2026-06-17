import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { SheetPrimaryFooter } from '@components/SheetPrimaryFooter'
import FilterBar from '@components/TipTap/pad-title-section/FilterBar'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { usePopoverState } from '@components/ui/Popover'
import Toggle from '@components/ui/Toggle'
import { Icons } from '@icons'
import { RESET_FILTER } from '@services/eventsHub'
import { useStore } from '@stores'
import type { PanelSurfaceVariant } from '@types'
import { filterTextMatch } from '@utils/filterTextMatch'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { type FilterSuggestion, FilterSuggestions } from './FilterSuggestions'

const SUGGESTIONS_ID = 'filter-suggestions-listbox'
const MAX_SUGGESTIONS = 8
const optionId = (index: number) => `filter-suggestion-${index}`

// Typeahead matches are a heading-TEXT heuristic — not the applied-filter result,
// which the PM engine computes over section bodies + ancestor/descendant expansion.
const searchThroughHeading = (search: string): Element[] => {
  if (!search) return []
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
  return Array.from(headings).filter((h) => filterTextMatch(h.textContent || '', search))
}

const highlightTocHeadings = (headings: Element[]): void => {
  const headingIds = new Set(headings.map((h) => h.getAttribute('data-toc-id')))
  document.querySelectorAll('.tiptap__toc .toc__item .toc__row').forEach((el) => {
    const match = headingIds.has(el.getAttribute('data-id'))
    el.classList.toggle('bg-warning/20', match)
    el.classList.toggle('text-base-content', !match)
  })
}

interface FilterPanelProps {
  className?: string
  onClose?: () => void
  variant?: PanelSurfaceVariant
}

const FilterPanel = ({ className = '', onClose, variant = 'popover' }: FilterPanelProps) => {
  const popoverState = usePopoverState()
  const handleClose = onClose || popoverState.close
  const isSheet = variant === 'sheet'
  const router = useRouter()
  const mode: 'or' | 'and' = router.query.mode === 'and' ? 'and' : 'or'

  const [filterInput, setFilterInput] = useState('')
  const [filteredHeadings, setFilteredHeadings] = useState<Element[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const sortedSlugs = useStore((state) => state.settings.editor.filterResult.sortedSlugs)

  const query = filterInput.trim()
  const totalSearch = filteredHeadings.length
  const showSuggestions = isOpen && query.length > 0

  // Matching headings → de-duped, capped suggestion rows.
  const suggestions = useMemo<FilterSuggestion[]>(() => {
    const seen = new Set<string>()
    const out: FilterSuggestion[] = []
    for (const h of filteredHeadings) {
      const text = (h.textContent || '').trim()
      if (!text) continue
      const id = h.getAttribute('data-toc-id') || text
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ id, text })
      if (out.length >= MAX_SUGGESTIONS) break
    }
    return out
  }, [filteredHeadings])

  const clearForm = useCallback(() => {
    setFilterInput('')
    setFilteredHeadings([])
    setActiveIndex(-1)
    setIsOpen(false)
    highlightTocHeadings([])
  }, [])

  useEffect(() => {
    highlightTocHeadings(filteredHeadings)
  }, [filteredHeadings])

  // Clear the imperative TOC tint on unmount — closing via the X or click-outside
  // bypasses clearForm, so stale highlights would otherwise linger on TOC rows.
  useEffect(() => () => highlightTocHeadings([]), [])

  // Keep the keyboard-active suggestion scrolled into view.
  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const applyFilterSegment = useCallback(
    (term: string) => {
      const trimmed = term.trim()
      if (!trimmed) return
      const url = new URL(router.asPath, window.location.origin)
      url.pathname = `${url.pathname}/${encodeURIComponent(trimmed)}`
      router.push(url.toString(), undefined, { shallow: true })
      clearForm()
    },
    [router, clearForm]
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFilterInput(value)
    setFilteredHeadings(searchThroughHeading(value.trim()))
    setActiveIndex(-1)
    setIsOpen(true)
  }, [])

  const handlePick = useCallback(
    (s: FilterSuggestion) => applyFilterSegment(s.text),
    [applyFilterSegment]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        if (showSuggestions) {
          e.preventDefault()
          setIsOpen(false)
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (showSuggestions && activeIndex >= 0 && suggestions[activeIndex]) {
          handlePick(suggestions[activeIndex])
        } else {
          applyFilterSegment(filterInput)
        }
        return
      }
      if (!showSuggestions || suggestions.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1 >= suggestions.length ? 0 : i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActiveIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActiveIndex(suggestions.length - 1)
      }
    },
    [showSuggestions, activeIndex, suggestions, handlePick, applyFilterSegment, filterInput]
  )

  const handleApplySearch = useCallback(
    () => applyFilterSegment(filterInput),
    [applyFilterSegment, filterInput]
  )

  const handleModeChange = useCallback(
    (next: 'or' | 'and') => {
      const url = new URL(router.asPath, window.location.origin)
      if (next === 'and') url.searchParams.set('mode', 'and')
      else url.searchParams.delete('mode')
      router.push(url.toString(), undefined, { shallow: true })
    },
    [router]
  )

  const handleClearAll = useCallback(() => {
    clearForm()
    PubSub.publish(RESET_FILTER, {})
  }, [clearForm])

  return (
    <PanelSurfaceShell
      variant={variant}
      title="Filter"
      className={className}
      popoverHeaderBordered={false}
      footer={
        isSheet ? (
          <SheetPrimaryFooter
            label="Apply filter"
            onClick={handleApplySearch}
            disabled={!query}
            testId="filter-sheet-apply"
          />
        ) : undefined
      }
      popoverHeader={
        <div className="flex items-center justify-between px-3 pt-2.5">
          <h2 className="text-base-content text-sm font-semibold">Filter</h2>
          <CloseButton onClick={handleClose} size="sm" aria-label="Close filter" />
        </div>
      }>
      <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
        {/* Search: daisyUI bordered input — the label wraps the inner combobox input */}
        <label className="input flex w-full items-center gap-2">
          <Icons.search size={16} className="text-base-content/50 shrink-0" />
          <input
            id="filterSearchBox"
            type="text"
            role="combobox"
            aria-label="Find in document"
            aria-expanded={showSuggestions}
            aria-controls={SUGGESTIONS_ID}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            autoComplete="off"
            value={filterInput}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            placeholder="Find in document..."
            className="text-base-content placeholder:text-base-content/40 grow bg-transparent text-sm focus:outline-none"
          />
          <span
            data-testid="filter-match-count"
            aria-live="polite"
            className={twMerge(
              'shrink-0 text-xs font-medium tabular-nums',
              totalSearch > 0 ? 'text-primary' : 'text-base-content/40'
            )}>
            {query ? `${totalSearch} ${totalSearch === 1 ? 'match' : 'matches'}` : ''}
          </span>
          {filterInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={clearForm}
              className="text-base-content/40 hover:text-base-content shrink-0 cursor-pointer">
              <Icons.close size={14} />
            </button>
          )}
        </label>

        {/* Auto-suggest: matching headings, click or Enter to filter to one */}
        {showSuggestions && (
          <FilterSuggestions
            suggestions={suggestions}
            query={query}
            activeIndex={activeIndex}
            listboxId={SUGGESTIONS_ID}
            optionId={optionId}
            onPick={handlePick}
            onHover={setActiveIndex}
          />
        )}

        {/* Active filters: inline chips + reset (only when filters exist) */}
        {sortedSlugs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-1 motion-safe:animate-[doc-region-in_160ms_ease-out_both]">
            <FilterBar className="flex-wrap" />
            <Button
              variant="ghost"
              size="xs"
              onClick={handleClearAll}
              startIcon={<Icons.filterX size={14} />}
              className="text-base-content/60 hover:text-error ml-auto gap-1">
              Reset
            </Button>
          </div>
        )}

        {/* Match mode: only meaningful with 2+ filters */}
        {sortedSlugs.length > 1 && (
          <label
            htmlFor="filter-mode-and"
            className="flex cursor-pointer items-center justify-between gap-3 px-1 text-sm motion-safe:animate-[doc-region-in_160ms_ease-out_both]">
            <span className="text-base-content/80">
              Match all <span className="text-base-content/45">(AND)</span>
            </span>
            <Toggle
              id="filter-mode-and"
              checked={mode === 'and'}
              onChange={() => handleModeChange(mode === 'and' ? 'or' : 'and')}
              size="sm"
              variant="primary"
            />
          </label>
        )}
      </div>
    </PanelSurfaceShell>
  )
}

export default FilterPanel
