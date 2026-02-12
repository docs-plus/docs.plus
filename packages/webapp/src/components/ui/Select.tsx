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
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { LuCheck, LuChevronDown } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

import { useSelectExclusion } from './hooks/useSelectExclusion'

// --- Types ---

export type SelectSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type SelectColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  /** Selected value (controlled mode). Omit for uncontrolled. */
  value?: string
  /** Callback when value changes */
  onChange?: (value: string) => void
  /** Options to display */
  options?: SelectOption[]
  /** Label text for the select */
  label?: string
  /** Position of the label: 'above' or 'floating' */
  labelPosition?: 'above' | 'floating'
  /** Size of the select */
  size?: SelectSize
  /** Color variant of the select */
  color?: SelectColor
  /** Whether to use ghost style (no border) */
  ghost?: boolean
  /** Placeholder text when no value selected */
  placeholder?: string
  /** Helper text displayed below the select */
  helperText?: string
  /** Error state */
  error?: boolean
  /** Success state */
  success?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Maximum height of the dropdown list */
  maxHeight?: number
  /** HTML id attribute */
  id?: string
  /** Additional wrapper class */
  wrapperClassName?: string
  /** Additional class for the trigger */
  className?: string
}

// --- Helpers ---

/** Build daisyUI select trigger classes */
const buildTriggerClasses = (
  size?: SelectSize,
  color?: SelectColor,
  ghost?: boolean,
  error?: boolean,
  success?: boolean
): string => {
  const classes: string[] = ['select', 'w-full', 'text-left']

  if (size) classes.push(`select-${size}`)
  if (error) classes.push('select-error')
  else if (success) classes.push('select-success')
  else if (color) classes.push(`select-${color}`)
  if (ghost) classes.push('select-ghost')

  return classes.join(' ')
}

// --- Component ---

/**
 * Custom Select component with a styled dropdown panel.
 *
 * Uses Floating UI for positioning and renders a proper dropdown
 * (not a native <select>) so the options panel follows the design system.
 *
 * @example
 * // Basic usage
 * <Select
 *   value={role}
 *   onChange={setRole}
 *   options={[
 *     { value: 'admin', label: 'Admin' },
 *     { value: 'editor', label: 'Editor' },
 *   ]}
 * />
 *
 * // With label
 * <Select
 *   label="Role"
 *   labelPosition="above"
 *   value={role}
 *   onChange={setRole}
 *   options={roleOptions}
 * />
 *
 * @see https://daisyui.com/components/select/
 */
const Select = ({
  value: controlledValue,
  onChange,
  options = [],
  label,
  labelPosition = 'above',
  size,
  color,
  ghost = false,
  placeholder = 'Select…',
  helperText,
  error = false,
  success = false,
  disabled = false,
  maxHeight = 240,
  id: _id,
  wrapperClassName,
  className
}: SelectProps) => {
  const generatedId = useId()
  const id = _id || generatedId

  // Support both controlled and uncontrolled modes
  const [internalValue, setInternalValue] = useState('')
  const value = controlledValue ?? internalValue

  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const listRef = useRef<HTMLDivElement>(null)

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
            maxHeight: `${Math.min(availableHeight - 16, maxHeight + 8)}px`
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

  const selectedOption = options.find((o) => o.value === value)
  const displayLabel = selectedOption?.label || placeholder

  // Only one dropdown open at a time (shared across Select + SearchableSelect)
  const closeDropdown = useCallback(() => setIsOpen(false), [])
  useSelectExclusion(id, isOpen, closeDropdown)

  // --- Effects ---

  useEffect(() => {
    if (isOpen) {
      const selectedIdx = options.findIndex((o) => o.value === value)
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0)

      // Scroll selected item into view after render
      requestAnimationFrame(() => {
        if (listRef.current && selectedIdx >= 0) {
          const el = listRef.current.children[selectedIdx] as HTMLElement
          el?.scrollIntoView({ block: 'nearest' })
        }
      })
    }
  }, [isOpen, options, value])

  // --- Select handler ---

  const handleSelect = useCallback(
    (optionValue: string) => {
      setInternalValue(optionValue)
      onChange?.(optionValue)
      setIsOpen(false)
    },
    [onChange]
  )

  // --- Keyboard navigation ---

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
          setHighlightedIndex((prev) => {
            let next = prev + 1
            while (next < options.length && options[next].disabled) next++
            return next < options.length ? next : prev
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => {
            let next = prev - 1
            while (next >= 0 && options[next].disabled) next--
            return next >= 0 ? next : prev
          })
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (highlightedIndex >= 0 && !options[highlightedIndex]?.disabled) {
            handleSelect(options[highlightedIndex].value)
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
          setHighlightedIndex(options.length - 1)
          break
      }
    },
    [isOpen, options, highlightedIndex, handleSelect]
  )

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current || highlightedIndex < 0) return
    const el = listRef.current.children[highlightedIndex] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isOpen])

  // --- Classes ---

  const triggerClasses = buildTriggerClasses(size, color, ghost, error, success)

  const helperTextClasses = twMerge(
    'label text-xs',
    error && 'text-error',
    success && 'text-success'
  )

  // --- Trigger button ---

  const triggerButton = (
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
        {displayLabel}
      </span>
      <LuChevronDown
        size={16}
        className={twMerge(
          'text-base-content/50 shrink-0 transition-transform duration-200',
          isOpen && 'rotate-180'
        )}
      />
    </button>
  )

  // --- Dropdown panel ---

  const dropdown = isOpen && (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        className="bg-base-100 border-base-300 rounded-box z-50 overflow-y-auto border shadow-lg"
        onKeyDown={handleKeyDown}
        role="listbox"
        aria-activedescendant={
          highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined
        }
        {...getFloatingProps()}>
        <div ref={listRef} className="py-1">
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isHighlighted = index === highlightedIndex

            return (
              <button
                key={option.value}
                id={`${id}-option-${index}`}
                type="button"
                disabled={option.disabled}
                onClick={() => !option.disabled && handleSelect(option.value)}
                onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                className={twMerge(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  isHighlighted && 'bg-base-200',
                  isSelected && 'text-primary font-medium',
                  option.disabled && 'text-base-content/30 cursor-not-allowed'
                )}
                role="option"
                aria-selected={isSelected}>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected && <LuCheck size={16} className="text-primary shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>
    </FloatingPortal>
  )

  // --- Render ---

  if (labelPosition === 'floating') {
    return (
      <div className={twMerge('form-control w-full', wrapperClassName)}>
        <label className="floating-label w-full">
          {label && <span>{label}</span>}
          {triggerButton}
        </label>
        {dropdown}
        {helperText && <p className={helperTextClasses}>{helperText}</p>}
      </div>
    )
  }

  // Default: 'above' label
  return (
    <div className={twMerge('form-control w-full', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className="label">
          <span className="label-text text-base-content">{label}</span>
        </label>
      )}
      {triggerButton}
      {dropdown}
      {helperText && <p className={helperTextClasses}>{helperText}</p>}
    </div>
  )
}

Select.displayName = 'Select'

export default Select
