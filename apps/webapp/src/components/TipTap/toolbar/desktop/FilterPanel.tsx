import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { SheetPrimaryFooter } from '@components/SheetPrimaryFooter'
import FilterBar from '@components/TipTap/pad-title-section/FilterBar'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { usePopoverState } from '@components/ui/Popover'
import Toggle from '@components/ui/Toggle'
import { useDismissPanel } from '@hooks/useDismissPanel'
import { Icons } from '@icons'
import { RESET_FILTER } from '@services/eventsHub'
import { useStore } from '@stores'
import type { PanelSurfaceVariant } from '@types'
import { appendFilterSegment, setFilterMode } from '@utils/filterRoute'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { FilterSuggestions } from './FilterSuggestions'
import { type FilterTypeaheadMatch, searchFilterSections } from './filterTypeahead'

const SUGGESTIONS_ID = 'filter-suggestions-listbox'
const MAX_SUGGESTIONS = 8
const optionId = (index: number) => `filter-suggestion-${index}`

const highlightTocSections = (sectionIds: Set<string>): void => {
  document.querySelectorAll('.tiptap__toc .toc__item .toc__row').forEach((el) => {
    const match = sectionIds.has(el.getAttribute('data-id') ?? '')
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
  const isSheet = variant === 'sheet'
  const popoverState = usePopoverState()
  const dismissPanel = useDismissPanel(variant)
  const handleClose = onClose ?? (isSheet ? dismissPanel : popoverState.close)
  const router = useRouter()
  const editor = useStore((state) => state.settings.editor.instance)
  const sortedSlugs = useStore((state) => state.settings.editor.filterResult.sortedSlugs)
  const mode: 'or' | 'and' = router.query.mode === 'and' ? 'and' : 'or'

  const [filterInput, setFilterInput] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)

  const query = filterInput.trim()
  const showSuggestions = isOpen && query.length > 0

  const suggestions = useMemo((): FilterTypeaheadMatch[] => {
    if (!editor || !query) return []
    return searchFilterSections(editor.state.doc, query, MAX_SUGGESTIONS)
  }, [editor, query])

  const clearForm = useCallback(() => {
    setFilterInput('')
    setActiveIndex(-1)
    setIsOpen(false)
  }, [])

  const dismissSheetIfNeeded = useCallback(() => {
    if (isSheet) dismissPanel()
  }, [isSheet, dismissPanel])

  const pushShallow = useCallback(
    (href: string) => {
      void router.push(href, undefined, { shallow: true })
    },
    [router]
  )

  useEffect(() => {
    highlightTocSections(new Set(suggestions.map((match) => match.id)))
  }, [suggestions])

  useEffect(() => () => highlightTocSections(new Set()), [])

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const applyFilterSegment = useCallback(
    (term: string) => {
      const href = appendFilterSegment(router.asPath, term)
      if (!href) return
      pushShallow(href)
      clearForm()
      dismissSheetIfNeeded()
    },
    [router.asPath, pushShallow, clearForm, dismissSheetIfNeeded]
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
        const picked = showSuggestions && activeIndex >= 0 ? suggestions[activeIndex] : null
        applyFilterSegment(picked?.text ?? filterInput)
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
    [showSuggestions, activeIndex, suggestions, applyFilterSegment, filterInput]
  )

  const handleClearAll = useCallback(() => {
    clearForm()
    PubSub.publish(RESET_FILTER, {})
    dismissSheetIfNeeded()
  }, [clearForm, dismissSheetIfNeeded])

  const matchCountLabel = query
    ? `${suggestions.length} section ${suggestions.length === 1 ? 'match' : 'matches'}`
    : ''

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
            onClick={() => applyFilterSegment(filterInput)}
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
            onChange={(e) => {
              setFilterInput(e.target.value)
              setActiveIndex(-1)
              setIsOpen(true)
            }}
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
              suggestions.length > 0 ? 'text-primary' : 'text-base-content/40'
            )}>
            {matchCountLabel}
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

        {showSuggestions && (
          <FilterSuggestions
            suggestions={suggestions}
            query={query}
            activeIndex={activeIndex}
            listboxId={SUGGESTIONS_ID}
            optionId={optionId}
            onPick={(suggestion) => applyFilterSegment(suggestion.text)}
            onHover={setActiveIndex}
          />
        )}

        {sortedSlugs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-1 motion-safe:animate-[doc-region-in_160ms_ease-out_both]">
            <FilterBar className="flex-wrap" />
            {!isSheet && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleClearAll}
                startIcon={<Icons.filterX size={14} />}
                className="text-base-content/60 hover:text-error ml-auto gap-1">
                Reset
              </Button>
            )}
          </div>
        )}

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
              onChange={() =>
                pushShallow(setFilterMode(router.asPath, mode === 'and' ? 'or' : 'and'))
              }
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
