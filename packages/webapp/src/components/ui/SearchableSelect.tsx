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
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { LuCheck, LuChevronDown, LuSearch } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

import { useSelectExclusion } from './hooks/useSelectExclusion'
import type { SelectSize } from './Select'

// --- Types ---

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  /** Custom searchable text (if not provided, searches label, value, and description) */
  searchText?: string
}

export interface SearchableSelectProps {
  /** Selected value */
  value: string
  /** Callback when value changes */
  onChange: (value: string) => void
  /** Options to display */
  options: SearchableSelectOption[]
  /** Placeholder text when no value selected */
  placeholder?: string
  /** Search input placeholder */
  searchPlaceholder?: string
  /** Label for the select */
  label?: string
  /** Helper text below the select */
  helperText?: string
  /** Disabled state */
  disabled?: boolean
  /** Size variant — matches DaisyUI select sizes */
  size?: SelectSize
  /** Additional className for trigger button */
  className?: string
  /** Additional wrapper class */
  wrapperClassName?: string
  /** Maximum height of dropdown list (not including search) */
  maxHeight?: number
  /** Empty state message */
  emptyMessage?: string
}

// --- Helpers ---

/** Build daisyUI select trigger classes (shared pattern with Select) */
const buildTriggerClasses = (size?: SelectSize): string => {
  const classes: string[] = ['select', 'w-full', 'text-left']
  if (size) classes.push(`select-${size}`)
  return classes.join(' ')
}

// --- Component ---

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
  emptyMessage = 'No options found'
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

  // --- Floating UI ---

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
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

  const click = useClick(context, { enabled: !disabled })
  const dismiss = useDismiss(context, { outsidePress: true, outsidePressEvent: 'mousedown' })
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  // --- Derived ---

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const searchLower = search.toLowerCase()
    return options.filter((opt) => {
      if (opt.searchText) return opt.searchText.includes(searchLower)
      return (
        opt.label.toLowerCase().includes(searchLower) ||
        opt.value.toLowerCase().includes(searchLower) ||
        opt.description?.toLowerCase().includes(searchLower)
      )
    })
  }, [options, search])

  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption?.label || placeholder

  // --- Effects ---

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setHighlightedIndex(0)
      setTimeout(() => searchInputRef.current?.focus(), 10)
    }
  }, [isOpen])

  // Scroll highlighted option into view
  useEffect(() => {
    if (!isOpen || !listRef.current || highlightedIndex < 0) return
    const el = listRef.current.children[highlightedIndex] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isOpen])

  // --- Select handler ---

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue)
      setIsOpen(false)
    },
    [onChange]
  )

  // --- Keyboard navigation (aligned with Select) ---

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

  // --- Classes ---

  const triggerClasses = buildTriggerClasses(size)

  // --- Render ---

  return (
    <div className={twMerge('form-control w-full', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className="label">
          <span className="label-text text-base-content">{label}</span>
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
        onKeyDown={handleKeyDown}
        {...getReferenceProps()}>
        <span className={twMerge('truncate', !selectedOption && 'text-base-content/50')}>
          {displayValue}
        </span>
        <LuChevronDown
          size={16}
          className={twMerge(
            'text-base-content/50 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown — portal for proper z-index */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="bg-base-100 border-base-300 rounded-box z-50 flex flex-col overflow-hidden border shadow-lg"
            onKeyDown={handleKeyDown}
            aria-activedescendant={
              highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined
            }
            {...getFloatingProps()}>
            {/* Search Input */}
            <div className="border-base-300 shrink-0 border-b p-2">
              <div className="relative">
                <LuSearch
                  size={16}
                  className="text-base-content/40 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setHighlightedIndex(0)
                  }}
                  placeholder={searchPlaceholder}
                  className="bg-base-200 text-base-content placeholder:text-base-content/40 w-full rounded-md py-1.5 pr-3 pl-8 text-sm outline-none"
                />
              </div>
            </div>

            {/* Options List */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto"
              style={{ maxHeight }}
              role="listbox">
              {filteredOptions.length === 0 ? (
                <div className="text-base-content/50 px-3 py-4 text-center text-sm">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value
                  const isHighlighted = index === highlightedIndex

                  return (
                    <button
                      key={option.value}
                      id={`${id}-option-${index}`}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={twMerge(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                        isHighlighted && 'bg-base-200',
                        isSelected && 'text-primary font-medium'
                      )}
                      role="option"
                      aria-selected={isSelected}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className="text-base-content/50 block truncate text-xs">
                            {option.description}
                          </span>
                        )}
                      </span>
                      {isSelected && <LuCheck size={16} className="text-primary shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </FloatingPortal>
      )}

      {helperText && <p className="text-base-content/50 mt-1 text-xs">{helperText}</p>}
    </div>
  )
}

SearchableSelect.displayName = 'SearchableSelect'

export default SearchableSelect
