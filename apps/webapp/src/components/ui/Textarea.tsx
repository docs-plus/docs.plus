import { forwardRef, TextareaHTMLAttributes, useId } from 'react'
import { twMerge } from 'tailwind-merge'

export type TextareaSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type TextareaColor =
  'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string
  labelPosition?: 'above' | 'floating'
  size?: TextareaSize
  color?: TextareaColor
  ghost?: boolean
  helperText?: string
  error?: boolean
  success?: boolean
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

    const helperTextClasses = twMerge(
      'label text-xs',
      error && 'text-error',
      success && 'text-success'
    )

    // daisyUI 5.5+: the span MUST come before the textarea or the label never floats.
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
