import { twMerge } from '@utils/twMerge'
import { forwardRef, InputHTMLAttributes, useId } from 'react'

import { FieldHelp } from './FieldHelp'

export type ToggleSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ToggleVariant =
  'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  size?: ToggleSize
  variant?: ToggleVariant
  helperText?: string
  wrapperClassName?: string
}

const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  (
    { label, size, variant, helperText, wrapperClassName, className, id: _id, disabled, ...props },
    ref
  ) => {
    const generatedId = useId()
    const id = _id || generatedId

    // Explicit checked/unchecked tokens — daisyUI's default `toggle-<variant>`
    // applies the color on the knob (subtle on muted themes). Forcing the
    // track to base-300 when off and primary when on makes the state
    // unmistakable.
    const toggleClasses = twMerge(
      'toggle',
      'bg-base-300 border-base-content/20',
      'checked:bg-primary checked:border-primary checked:text-primary-content',
      // An outline, not a ring: daisyUI draws the knob with box-shadow. Its own
      // outline is currentColor, which is primary-content when checked.
      'focus-visible:[outline:var(--focus-ring-soft)] focus-visible:outline-offset-1',
      size && `toggle-${size}`,
      variant && `toggle-${variant}`,
      className
    )

    if (!label) {
      return (
        <input
          ref={ref}
          type="checkbox"
          id={id}
          className={toggleClasses}
          disabled={disabled}
          {...props}
        />
      )
    }

    const helperId = helperText ? `${id}-help` : undefined
    const describedBy = [props['aria-describedby'], helperId].filter(Boolean).join(' ') || undefined

    return (
      <div className={twMerge('flex flex-col items-start gap-1.5', wrapperClassName)}>
        <label
          htmlFor={id}
          className={twMerge(
            'inline-flex cursor-pointer items-center gap-3',
            disabled && 'cursor-not-allowed'
          )}>
          <input
            ref={ref}
            type="checkbox"
            id={id}
            className={toggleClasses}
            disabled={disabled}
            {...props}
            aria-describedby={describedBy}
          />
          <span
            className={twMerge('text-base-content text-sm', disabled && 'text-base-content/40')}>
            {label}
          </span>
        </label>
        {helperText && <FieldHelp id={helperId}>{helperText}</FieldHelp>}
      </div>
    )
  }
)

Toggle.displayName = 'Toggle'

export default Toggle
