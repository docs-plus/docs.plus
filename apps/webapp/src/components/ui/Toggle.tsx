import { forwardRef, InputHTMLAttributes, useId } from 'react'
import { twMerge } from 'tailwind-merge'

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
