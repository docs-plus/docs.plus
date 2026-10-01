import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size as floatingSize,
  useClick,
  useDismiss,
  useFloating,
  useInteractions
} from '@floating-ui/react'
import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { ContextMenuRow } from './ContextMenu'
import { FieldHelp, fieldLabelClassName } from './FieldHelp'
import { useSelectExclusion } from './hooks/useSelectExclusion'
import { popoverPanelClassName } from './Popover'
import { ScrollArea } from './ScrollArea'
import { type SelectSize, selectSizeClassName } from './Select'
import TextInput from './TextInput'
import { useOverlayTransition } from './useOverlayTransition'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  /** Extra search haystack; default is label + value + description. */
  searchText?: string
}

export interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  label?: string
  helperText?: string
  disabled?: boolean
  size?: SelectSize
  className?: string
  wrapperClassName?: string
  maxHeight?: number
  emptyMessage?: string
  /** Merged onto the option label, on the trigger and in the list. */
  optionLabelClassName?: string
}

const WORD_CHAR = /[\p{L}\p{N}]/u

/** 0 when a whole word equals the query, 1 when a word starts with it, else 2. */
const matchRank = (text: string, query: string): number => {
  let rank = 2
  for (let i = text.indexOf(query); i !== -1; i = text.indexOf(query, i + 1)) {
    if (i > 0 && WORD_CHAR.test(text[i - 1])) continue
    const end = i + query.length
    if (end === text.length || !WORD_CHAR.test(text[end])) return 0
    rank = 1
  }
  return rank
}

// Substring filter, then a stable sort lifts word matches in the label or
// description, so `india` shows India before `Indian/*` and `America/Indiana/*`.
export const searchOptions = (
  options: SearchableSelectOption[],
  search: string
): SearchableSelectOption[] => {
  if (!search.trim()) return options
  const searchLower = search.toLowerCase()
  const matches = options.filter((opt) => {
    if (opt.searchText) return opt.searchText.includes(searchLower)
    return (
      opt.label.toLowerCase().includes(searchLower) ||
      opt.value.toLowerCase().includes(searchLower) ||
      opt.description?.toLowerCase().includes(searchLower)
    )
  })
  const query = searchLower.trim()
  return matches
    .map((opt) => ({
      opt,
      rank: matchRank(`${opt.label} ${opt.description ?? ''}`.toLowerCase(), query)
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ opt }) => opt)
}

/** Keep in lockstep with `Select`'s trigger classes. */
const buildTriggerClasses = (size?: SelectSize): string => {
  const classes: string[] = ['select', 'w-full', 'text-left']
  if (size) classes.push(selectSizeClassName[size])
  return classes.join(' ')
}

const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  label,
  helperText,
  disabled = false,
  size,
  className,
  wrapperClassName,
  maxHeight = 200,
  emptyMessage = 'No options found.',
  optionLabelClassName
}: SearchableSelectProps) => {
  const id = useId()

  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Only one dropdown open at a time (shared across Select + SearchableSelect)
  const closeDropdown = useCallback(() => setIsOpen(false), [])
  useSelectExclusion(id, isOpen, closeDropdown)

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    // left/top positioning — the overlay transition animates `transform: scale()`.
    transform: false,
    middleware: [
      offset(4),
      flip({ fallbackAxisSideDirection: 'start', padding: 8 }),
      shift({ padding: 8 }),
      floatingSize({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.min(availableHeight - 16, maxHeight + 52)}px`
          })
        },
        padding: 8
      })
    ]
  })

  // Overlay tier: 120ms scale-in from the anchor, 80ms fade-out, PRM-gated.
  const { isMounted, styles: transitionStyles } = useOverlayTransition(context)

  const click = useClick(context, { enabled: !disabled })
  const dismiss = useDismiss(context, { outsidePress: true, outsidePressEvent: 'mousedown' })
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  const filteredOptions = useMemo(() => searchOptions(options, search), [options, search])

  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption?.label || placeholder

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setHighlightedIndex(0)
      setTimeout(() => searchInputRef.current?.focus(), 10)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !listRef.current || highlightedIndex < 0) return
    const el = listRef.current.children[highlightedIndex] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isOpen])

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue)
      setIsOpen(false)
    },
    [onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault()
          setIsOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
        case ' ':
          // Space only selects if focus is NOT on the search input
          if (e.key === ' ' && document.activeElement === searchInputRef.current) break
          e.preventDefault()
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value)
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          break
        case 'Tab':
          setIsOpen(false)
          break
        case 'Home':
          e.preventDefault()
          setHighlightedIndex(0)
          break
        case 'End':
          e.preventDefault()
          setHighlightedIndex(filteredOptions.length - 1)
          break
      }
    },
    [isOpen, filteredOptions, highlightedIndex, handleSelect]
  )

  const triggerClasses = buildTriggerClasses(size)
  const helperId = helperText ? `${id}-help` : undefined
  const listboxId = `${id}-listbox`

  return (
    <div className={twMerge('flex w-full flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className={fieldLabelClassName}>
          {label}
        </label>
      )}

      {/* Trigger Button — uses DaisyUI select class (same as Select) */}
      <button
        ref={refs.setReference}
        type="button"
        id={id}
        disabled={disabled}
        className={twMerge(
          triggerClasses,
          'flex items-center justify-between bg-none pr-3',
          disabled && 'select-disabled cursor-not-allowed',
          isOpen && 'select-primary',
          className
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-describedby={helperId}
        {...getReferenceProps({ onKeyDown: handleKeyDown })}>
        <span
          className={twMerge(
            'truncate',
            !selectedOption && 'text-base-content/50',
            optionLabelClassName
          )}>
          {displayValue}
        </span>
        <Icons.chevronDown
          size={16}
          className={twMerge(
            'text-base-content/50 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown — portal for proper z-index */}
      {isMounted && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, ...transitionStyles }}
            className={twMerge(popoverPanelClassName, 'flex min-h-0 w-auto flex-col')}
            onKeyDown={handleKeyDown}
            {...getFloatingProps()}>
            <div className="border-base-300 shrink-0 border-b p-2">
              <TextInput
                ref={searchInputRef}
                ghost
                size="sm"
                startIcon={<Icons.search size={16} className="text-base-content/60 shrink-0" />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlightedIndex(0)
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listboxId}
                aria-activedescendant={
                  filteredOptions.length > 0 ? `${id}-option-${highlightedIndex}` : undefined
                }
                autoComplete="off"
              />
            </div>

            <ScrollArea
              scrollbarSize="thin"
              preserveWidth={false}
              className="min-h-0 min-w-0 flex-1"
              style={{ maxHeight }}>
              <div ref={listRef} id={listboxId} role="listbox" className="p-1.5">
                {filteredOptions.length === 0 ? (
                  <div className="text-base-content/60 px-2.5 py-2 text-sm">{emptyMessage}</div>
                ) : (
                  filteredOptions.map((option, index) => {
                    const isSelected = option.value === value

                    return (
                      <button
                        key={option.value}
                        id={`${id}-option-${index}`}
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleSelect(option.value)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className="group block w-full text-left"
                        role="option"
                        aria-selected={isSelected}>
                        <ContextMenuRow
                          active={index === highlightedIndex}
                          trailing={
                            isSelected && (
                              <Icons.check size={16} className="text-primary" aria-hidden />
                            )
                          }>
                          <span className={twMerge('block truncate', optionLabelClassName)}>
                            {option.label}
                          </span>
                          {option.description && (
                            <span className="text-base-content/60 block truncate text-xs font-normal">
                              {option.description}
                            </span>
                          )}
                        </ContextMenuRow>
                      </button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </FloatingPortal>
      )}

      {helperText && <FieldHelp id={helperId}>{helperText}</FieldHelp>}
    </div>
  )
}

SearchableSelect.displayName = 'SearchableSelect'

export default SearchableSelect
