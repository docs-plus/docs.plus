import { forwardRef, InputHTMLAttributes,useId } from 'react'
import { twMerge } from 'tailwind-merge'

export type CheckboxSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type CheckboxColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  /** Label text for the checkbox */
  label?: string
  /** Size of the checkbox */
  size?: CheckboxSize
  /** Color variant of the checkbox */
  color?: CheckboxColor
  /** Helper text displayed below the checkbox */
  helperText?: string
  /** Additional wrapper class */
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
            id={id}
            type="checkbox"
            className={twMerge(checkboxClasses, className)}
            disabled={disabled}
            {...props}
          />
          {label && <span className="label-text text-base-content">{label}</span>}
        </label>
        {helperText && <p className="label text-base-content/70 text-xs">{helperText}</p>}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox
