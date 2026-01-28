import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size as floatingSize,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal
} from '@floating-ui/react'
import { MdSearch, MdExpandMore, MdCheck } from 'react-icons/md'
import { twMerge } from 'tailwind-merge'

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
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional className for trigger button */
  className?: string
  /** Maximum height of dropdown list (not including search) */
  maxHeight?: number
  /** Empty state message */
  emptyMessage?: string
}

const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  label,
  helperText,
  disabled = false,
  size = 'sm',
  className,
  maxHeight = 200,
  emptyMessage = 'No options found'
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Floating UI setup with auto-flip positioning
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({
        fallbackAxisSideDirection: 'start',
        padding: 8
      }),
      shift({ padding: 8 }),
      floatingSize({
        apply({ rects, elements, availableHeight }) {
          // Match trigger width and constrain height to available space
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
  const dismiss = useDismiss(context, {
    outsidePress: true,
    outsidePressEvent: 'mousedown'
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const searchLower = search.toLowerCase()
    return options.filter((opt) => {
      if (opt.searchText) {
        return opt.searchText.includes(searchLower)
      }
      return (
        opt.label.toLowerCase().includes(searchLower) ||
        opt.value.toLowerCase().includes(searchLower) ||
        opt.description?.toLowerCase().includes(searchLower)
      )
    })
  }, [options, search])

  // Find selected option label
  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption?.label || placeholder

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setHighlightedIndex(0)
      setTimeout(() => searchInputRef.current?.focus(), 10)
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
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
          e.preventDefault()
          if (filteredOptions[highlightedIndex]) {
            onChange(filteredOptions[highlightedIndex].value)
            setIsOpen(false)
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          break
        case 'Tab':
          setIsOpen(false)
          break
      }
    },
    [isOpen, filteredOptions, highlightedIndex, onChange]
  )

  // Scroll highlighted option into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  // Size classes
  const sizeClasses = {
    sm: 'h-8 text-sm px-3',
    md: 'h-10 text-sm px-4',
    lg: 'h-12 text-base px-4'
  }

  return (
    <div className="w-full">
      {label && <label className="text-base-content mb-1 block text-sm font-medium">{label}</label>}

      {/* Trigger Button */}
      <button
        ref={refs.setReference}
        type="button"
        disabled={disabled}
        className={twMerge(
          'bg-base-100 border-base-300 text-base-content flex w-full items-center justify-between rounded-lg border transition-colors',
          'hover:border-base-content/30 focus:border-primary focus:ring-primary/30 focus:ring-1 focus:outline-none',
          disabled && 'cursor-not-allowed opacity-50',
          isOpen && 'border-primary ring-primary/30 ring-1',
          sizeClasses[size],
          className
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onKeyDown={handleKeyDown}
        {...getReferenceProps()}>
        <span className={twMerge('truncate', !selectedOption && 'text-base-content/50')}>
          {displayValue}
        </span>
        <MdExpandMore
          size={20}
          className={twMerge(
            'text-base-content/50 shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown - Portal for proper positioning */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="bg-base-100 border-base-300 z-50 flex flex-col overflow-hidden rounded-lg border shadow-lg"
            onKeyDown={handleKeyDown}
            {...getFloatingProps()}>
            {/* Search Input */}
            <div className="border-base-300 shrink-0 border-b p-2">
              <div className="relative">
                <MdSearch
                  size={18}
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
                filteredOptions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={twMerge(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                      index === highlightedIndex && 'bg-base-200',
                      option.value === value && 'text-primary font-medium'
                    )}
                    role="option"
                    aria-selected={option.value === value}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="text-base-content/50 block truncate text-xs">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {option.value === value && (
                      <MdCheck size={16} className="text-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </FloatingPortal>
      )}

      {helperText && <p className="text-base-content/50 mt-1 text-xs">{helperText}</p>}
    </div>
  )
}

export default SearchableSelect
