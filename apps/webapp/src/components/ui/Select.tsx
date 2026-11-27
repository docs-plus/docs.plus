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
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { ContextMenuRow } from './ContextMenu'
import { FieldHelp, fieldLabelClassName } from './FieldHelp'
import { useSelectExclusion } from './hooks/useSelectExclusion'
import { popoverPanelClassName } from './Popover'
import { ScrollArea } from './ScrollArea'
import { useOverlayTransition } from './useOverlayTransition'

export type SelectSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface SelectOption {
  value: string
  label: string
  /** Quiet end-of-row note in the list only, such as "Default". */
  hint?: string
  disabled?: boolean
}

export interface SelectProps {
  /** Omit for uncontrolled. */
  value?: string
  onChange?: (value: string) => void
  options?: SelectOption[]
  label?: string
  labelPosition?: 'above' | 'floating'
  size?: SelectSize
  ghost?: boolean
  placeholder?: string
  /** Help line under the field. With `error`, it renders as the error line. */
  helperText?: string
  error?: boolean
  success?: boolean
  disabled?: boolean
  maxHeight?: number
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  wrapperClassName?: string
  className?: string
}

/** Whole names, not `select-${size}`: Tailwind only emits classes it finds written out. */
export const selectSizeClassName: Record<SelectSize, string> = {
  xs: 'select-xs',
  sm: 'select-sm',
  md: 'select-md',
  lg: 'select-lg',
  xl: 'select-xl'
}

/**
 * Renders a Floating UI dropdown, not a native `<select>`, so the options panel
 * can follow the design system.
 * @see https://daisyui.com/components/select/
 */
const Select = ({
  value: controlledValue,
  onChange,
  options = [],
  label,
  labelPosition = 'above',
  size,
  ghost = false,
  placeholder = 'Select…',
  helperText,
  error = false,
  success = false,
  disabled = false,
  maxHeight = 240,
  id: _id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  wrapperClassName,
  className
}: SelectProps) => {
  const generatedId = useId()
  const id = _id || generatedId
  const labelId = label ? `${id}-label` : undefined
  const listboxId = `${id}-listbox`

  const [internalValue, setInternalValue] = useState('')
  const value = controlledValue ?? internalValue

  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const listRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

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
            maxHeight: `${Math.min(availableHeight - 16, maxHeight + 12)}px`
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

  const selectedOption = options.find((o) => o.value === value)
  const displayLabel = selectedOption?.label || placeholder

  // Only one dropdown open at a time (shared across Select + SearchableSelect)
  const closeDropdown = useCallback(() => setIsOpen(false), [])
  useSelectExclusion(id, isOpen, closeDropdown)

  useEffect(() => {
    if (!isOpen) return

    const currentOptions = optionsRef.current
    if (currentOptions.length === 0) {
      setHighlightedIndex(-1)
      return
    }

    const selectedIdx = currentOptions.findIndex((o) => o.value === value && !o.disabled)
    const initialIdx = selectedIdx >= 0 ? selectedIdx : currentOptions.findIndex((o) => !o.disabled)
    setHighlightedIndex(initialIdx)
  }, [isOpen, value])

  const handleSelect = useCallback(
    (optionValue: string) => {
      setInternalValue(optionValue)
      onChange?.(optionValue)
      setIsOpen(false)
    },
    [onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (options.length > 0 && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault()
          setIsOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (options.length === 0) return
          setHighlightedIndex((prev) => {
            let next = prev + 1
            while (next < options.length && options[next].disabled) next++
            return next < options.length ? next : prev
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          if (options.length === 0) return
          setHighlightedIndex((prev) => {
            let next = prev < 0 ? options.length - 1 : prev - 1
            while (next >= 0 && options[next].disabled) next--
            return next >= 0 ? next : prev
          })
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < options.length &&
            !options[highlightedIndex]?.disabled
          ) {
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
        case 'Home': {
          e.preventDefault()
          const firstEnabled = options.findIndex((o) => !o.disabled)
          if (firstEnabled >= 0) setHighlightedIndex(firstEnabled)
          break
        }
        case 'End': {
          e.preventDefault()
          let lastEnabled = options.length - 1
          while (lastEnabled >= 0 && options[lastEnabled].disabled) lastEnabled--
          if (lastEnabled >= 0) setHighlightedIndex(lastEnabled)
          break
        }
      }
    },
    [isOpen, options, highlightedIndex, handleSelect]
  )

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return
    const rafId = requestAnimationFrame(() => {
      const el = listRef.current?.children[highlightedIndex] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(rafId)
  }, [isOpen, highlightedIndex])

  const activeOptionId =
    isOpen && highlightedIndex >= 0 && highlightedIndex < options.length
      ? `${id}-option-${highlightedIndex}`
      : undefined

  const helperId = helperText ? `${id}-help` : undefined

  const helperTextEl = helperText && (
    <FieldHelp id={helperId} error={error} success={success}>
      {helperText}
    </FieldHelp>
  )

  const triggerButton = (
    <button
      ref={refs.setReference}
      type="button"
      role="combobox"
      id={id}
      disabled={disabled}
      className={twMerge(
        'select flex w-full items-center justify-between bg-none pr-3 text-left',
        size && selectSizeClassName[size],
        error ? 'select-error' : success && 'select-success',
        ghost && 'select-ghost',
        disabled && 'select-disabled cursor-not-allowed',
        isOpen && 'select-primary',
        className
      )}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={isOpen ? listboxId : undefined}
      aria-activedescendant={activeOptionId}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-invalid={error || undefined}
      aria-describedby={helperId}
      {...getReferenceProps({ onKeyDown: handleKeyDown })}>
      <span className={twMerge('truncate', !selectedOption && 'text-base-content/50')}>
        {displayLabel}
      </span>
      <Icons.chevronDown
        size={16}
        aria-hidden
        className={twMerge(
          'text-base-content/50 shrink-0 transition-transform duration-200',
          isOpen && 'rotate-180'
        )}
      />
    </button>
  )

  const dropdown = isMounted && (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        id={listboxId}
        style={{ ...floatingStyles, ...transitionStyles }}
        className={twMerge(popoverPanelClassName, 'flex min-h-0 w-auto flex-col')}
        role="listbox"
        aria-labelledby={labelId ?? ariaLabelledBy ?? (!ariaLabel ? id : undefined)}
        aria-label={!labelId && !ariaLabelledBy ? ariaLabel : undefined}
        {...getFloatingProps({ onKeyDown: handleKeyDown })}>
        <ScrollArea scrollbarSize="thin" preserveWidth={false} className="min-h-0 min-w-0 flex-1">
          <div ref={listRef} className="p-1.5">
            {options.map((option, index) => {
              const isSelected = option.value === value

              return (
                <button
                  key={option.value}
                  id={`${id}-option-${index}`}
                  type="button"
                  tabIndex={-1}
                  disabled={option.disabled}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                  className="group block w-full text-left"
                  role="option"
                  aria-selected={isSelected}>
                  <ContextMenuRow
                    active={index === highlightedIndex}
                    disabled={option.disabled}
                    trailing={
                      (option.hint || isSelected) && (
                        <span className="flex items-center gap-2">
                          {option.hint && (
                            <span className="text-meta text-base-content/60">{option.hint}</span>
                          )}
                          {isSelected && (
                            <Icons.check size={16} className="text-primary" aria-hidden />
                          )}
                        </span>
                      )
                    }>
                    <span className="block truncate">{option.label}</span>
                  </ContextMenuRow>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </FloatingPortal>
  )

  return (
    <div className={twMerge('flex w-full flex-col gap-1.5', wrapperClassName)}>
      {labelPosition === 'floating' ? (
        <label className="floating-label w-full">
          {label && <span id={labelId}>{label}</span>}
          {triggerButton}
        </label>
      ) : (
        <>
          {label && (
            <label id={labelId} htmlFor={id} className={fieldLabelClassName}>
              {label}
            </label>
          )}
          {triggerButton}
        </>
      )}
      {dropdown}
      {helperTextEl}
    </div>
  )
}

Select.displayName = 'Select'

export default Select
