import { forwardRef, TextareaHTMLAttributes, useId } from 'react'
import { twMerge } from 'tailwind-merge'

export type TextareaSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type TextareaColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** Label text for the textarea */
  label?: string
  /** Position of the label: 'above' or 'floating' */
  labelPosition?: 'above' | 'floating'
  /** Size of the textarea */
  size?: TextareaSize
  /** Color variant of the textarea */
  color?: TextareaColor
  /** Whether to use ghost style (no border) */
  ghost?: boolean
  /** Helper text displayed below the textarea */
  helperText?: string
  /** Error state - shows error styling */
  error?: boolean
  /** Success state - shows success styling */
  success?: boolean
  /** Additional wrapper class */
  wrapperClassName?: string
}

const buildTextareaClasses = (
  size?: TextareaSize,
  color?: TextareaColor,
  ghost?: boolean,
  error?: boolean,
  success?: boolean
): string => {
  const classes: string[] = ['textarea', 'w-full']

  if (size) {
    classes.push(`textarea-${size}`)
  }

  // Priority: error > success > color
  if (error) {
    classes.push('textarea-error')
  } else if (success) {
    classes.push('textarea-success')
  } else if (color) {
    classes.push(`textarea-${color}`)
  }

  if (ghost) {
    classes.push('textarea-ghost')
  }

  return classes.join(' ')
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
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
      wrapperClassName,
      className,
      id: _id,
      disabled,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = _id || generatedId

    const textareaClasses = buildTextareaClasses(size, color, ghost, error, success)

    // Helper text styling
    const helperTextClasses = twMerge(
      'label text-xs',
      error && 'text-error',
      success && 'text-success'
    )

    // Floating label pattern
    // NOTE: In daisyUI 5.5+, the span MUST come before the textarea.
    // The label floats above when focused or has content, and appears inside when empty/unfocused.
    if (labelPosition === 'floating') {
      return (
        <div className={twMerge('form-control w-full', wrapperClassName)}>
          <label className="floating-label w-full">
            {label && <span>{label}</span>}
            <textarea
              ref={ref}
              id={id}
              placeholder={props.placeholder || label || ' '}
              rows={rows}
              className={twMerge(textareaClasses, disabled && 'textarea-disabled', className)}
              disabled={disabled}
              {...props}
            />
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
        <textarea
          ref={ref}
          id={id}
          placeholder={props.placeholder || ' '}
          rows={rows}
          className={twMerge(textareaClasses, disabled && 'textarea-disabled', className)}
          disabled={disabled}
          {...props}
        />
        {helperText && <p className={helperTextClasses}>{helperText}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
