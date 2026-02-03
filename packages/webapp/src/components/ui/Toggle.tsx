import { forwardRef, InputHTMLAttributes, useId } from 'react'
import { twMerge } from 'tailwind-merge'

export type ToggleSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ToggleVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Label text for the toggle */
  label?: string
  /** Size of the toggle */
  size?: ToggleSize
  /** Color variant of the toggle */
  variant?: ToggleVariant
  /** Helper text displayed below the toggle */
  helperText?: string
  /** Additional wrapper class */
  wrapperClassName?: string
}

/**
 * Toggle component using daisyUI's native toggle styling.
 *
 * @example
 * // Basic usage
 * <Toggle checked={isEnabled} onChange={handleChange} />
 *
 * // With label
 * <Toggle label="Enable notifications" variant="primary" />
 *
 * // With size and variant
 * <Toggle size="sm" variant="primary" checked={true} />
 *
 * // All sizes: xs, sm, md, lg, xl
 * // All variants: primary, secondary, accent, success, warning, error, info
 */
const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  (
    { label, size, variant, helperText, wrapperClassName, className, id: _id, disabled, ...props },
    ref
  ) => {
    const generatedId = useId()
    const id = _id || generatedId

    const toggleClasses = twMerge(
      'toggle',
      size && `toggle-${size}`,
      variant && `toggle-${variant}`,
      className
    )

    // Simple toggle without label
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

    // Toggle with label
    return (
      <div className={twMerge('form-control', wrapperClassName)}>
        <label
          htmlFor={id}
          className={twMerge(
            'label cursor-pointer justify-start gap-3',
            disabled && 'cursor-not-allowed opacity-50'
          )}>
          <input
            ref={ref}
            type="checkbox"
            id={id}
            className={toggleClasses}
            disabled={disabled}
            {...props}
          />
          <span className="label-text text-base-content">{label}</span>
        </label>
        {helperText && <p className="label text-base-content/70 text-xs">{helperText}</p>}
      </div>
    )
  }
)

Toggle.displayName = 'Toggle'

export default Toggle
