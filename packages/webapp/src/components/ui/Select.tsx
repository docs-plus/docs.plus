import { forwardRef, ReactNode, SelectHTMLAttributes, useId } from 'react'
import { twMerge } from 'tailwind-merge'

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

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
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
  /** Helper text displayed below the select */
  helperText?: string
  /** Error state - shows error styling */
  error?: boolean
  /** Success state - shows success styling */
  success?: boolean
  /** Options for the select */
  options?: SelectOption[]
  /** Placeholder option text */
  placeholder?: string
  /** Additional wrapper class */
  wrapperClassName?: string
  /** Children (alternative to options prop) */
  children?: ReactNode
}

const buildSelectClasses = (
  size?: SelectSize,
  color?: SelectColor,
  ghost?: boolean,
  error?: boolean,
  success?: boolean
): string => {
  const classes: string[] = ['select', 'w-full']

  if (size) {
    classes.push(`select-${size}`)
  }

  // Priority: error > success > color
  if (error) {
    classes.push('select-error')
  } else if (success) {
    classes.push('select-success')
  } else if (color) {
    classes.push(`select-${color}`)
  }

  if (ghost) {
    classes.push('select-ghost')
  }

  return classes.join(' ')
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      labelPosition = 'above',
      size,
      color,
      ghost = false,
      helperText,
      error = false,
      success = false,
      options = [],
      placeholder,
      wrapperClassName,
      className,
      id: _id,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = _id || generatedId

    const selectClasses = buildSelectClasses(size, color, ghost, error, success)

    // Helper text styling
    const helperTextClasses = twMerge(
      'label text-xs',
      error && 'text-error',
      success && 'text-success'
    )

    // Floating label pattern
    // NOTE: In daisyUI 5.5+, the span MUST come before the select.
    // The label floats above when focused or has content, and appears inside when empty/unfocused.
    if (labelPosition === 'floating') {
      return (
        <div className={twMerge('form-control w-full', wrapperClassName)}>
          <label className="floating-label w-full">
            {label && <span>{label}</span>}
            <select
              ref={ref}
              id={id}
              className={twMerge(selectClasses, disabled && 'select-disabled', className)}
              disabled={disabled}
              {...props}>
              {placeholder && (
                <option value="" disabled>
                  {placeholder}
                </option>
              )}
              {children ||
                options.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          {helperText && <p className={helperTextClasses}>{helperText}</p>}
        </div>
      )
    }

    // Above label pattern (default)
    return (
      <div className={twMerge('form-control w-full', wrapperClassName)}>
        {label && (
          <label htmlFor={id} className="label">
            <span className="label-text text-base-content">{label}</span>
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={twMerge(selectClasses, disabled && 'select-disabled', className)}
          disabled={disabled}
          {...props}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children ||
            options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
        </select>
        {helperText && <p className={helperTextClasses}>{helperText}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
