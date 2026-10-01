import { twMerge } from '@utils/twMerge'
import { forwardRef, InputHTMLAttributes, useId } from 'react'

import { FieldHelp } from './FieldHelp'

export type CheckboxSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type CheckboxColor =
  'primary' | 'secondary' | 'accent' | 'neutral' | 'success' | 'warning' | 'info' | 'error'

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  label?: string
  size?: CheckboxSize
  color?: CheckboxColor
  helperText?: string
  wrapperClassName?: string
}

const buildCheckboxClasses = (size?: CheckboxSize, color?: CheckboxColor): string => {
  const classes: string[] = ['checkbox']

  if (size) {
    classes.push(`checkbox-${size}`)
  }

  if (color) {
    classes.push(`checkbox-${color}`)
  }

  return classes.join(' ')
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { label, size, color, helperText, wrapperClassName, className, id: _id, disabled, ...props },
    ref
  ) => {
    const generatedId = useId()
    const id = _id || generatedId

    const checkboxClasses = buildCheckboxClasses(size, color)
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
            id={id}
            type="checkbox"
            className={twMerge(checkboxClasses, className)}
            disabled={disabled}
            {...props}
            aria-describedby={describedBy}
          />
          {label && (
            <span
              className={twMerge('text-base-content text-sm', disabled && 'text-base-content/40')}>
              {label}
            </span>
          )}
        </label>
        {helperText && <FieldHelp id={helperId}>{helperText}</FieldHelp>}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox
