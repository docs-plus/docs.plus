import { twMerge } from '@utils/twMerge'
import { forwardRef, TextareaHTMLAttributes, useId } from 'react'

import { FieldHelp, fieldLabelClassName } from './FieldHelp'

export type TextareaSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type TextareaColor =
  'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string
  labelPosition?: 'above' | 'floating'
  size?: TextareaSize
  color?: TextareaColor
  ghost?: boolean
  /** Help line under the field. With `error`, it renders as the error line. */
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

    const helperId = helperText ? `${id}-help` : undefined
    const describedBy = [props['aria-describedby'], helperId].filter(Boolean).join(' ') || undefined

    const helperTextEl = helperText && (
      <FieldHelp id={helperId} error={error} success={success}>
        {helperText}
      </FieldHelp>
    )

    const textareaProps = {
      ref,
      id,
      rows,
      disabled,
      ...props,
      className: twMerge(textareaClasses, disabled && 'textarea-disabled', className),
      'aria-invalid': props['aria-invalid'] ?? (error || undefined),
      'aria-describedby': describedBy
    }

    // daisyUI 5.5+: the span MUST come before the textarea or the label never floats.
    if (labelPosition === 'floating') {
      return (
        <div className={twMerge('flex w-full flex-col gap-1.5', wrapperClassName)}>
          <label className="floating-label w-full">
            {label && <span>{label}</span>}
            <textarea {...textareaProps} placeholder={props.placeholder || label || ' '} />
          </label>
          {helperTextEl}
        </div>
      )
    }

    return (
      <div className={twMerge('flex w-full flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={id} className={fieldLabelClassName}>
            {label}
          </label>
        )}
        <textarea {...textareaProps} placeholder={props.placeholder || ' '} />
        {helperTextEl}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
