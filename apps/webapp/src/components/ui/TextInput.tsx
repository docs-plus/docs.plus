import { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react'
import { IconType } from 'react-icons'
import { twMerge } from 'tailwind-merge'

export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type InputColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text for the input */
  label?: string
  /** Position of the label: 'inside' (inline), 'floating', or 'above' */
  labelPosition?: 'inside' | 'floating' | 'above'
  /** Size of the input */
  size?: InputSize
  /** Color variant of the input */
  color?: InputColor
  /** Whether to use ghost style (no border) */
  ghost?: boolean
  /** Icon component or element to display at the start */
  startIcon?: IconType | ReactNode
  /** Icon component or element to display at the end */
  endIcon?: IconType | ReactNode
  /** Size of icons (default based on input size) */
  iconSize?: number
  /** Helper text displayed below the input */
  helperText?: string
  /** Error state - shows error styling */
  error?: boolean
  /** Success state - shows success styling */
  success?: boolean
  /** Options for datalist autocomplete */
  datalist?: string[]
  /** Additional wrapper class */
  wrapperClassName?: string
  /** Additional class for the input container (the element with 'input' class) */
  containerClassName?: string
}

const getDefaultIconSize = (size?: InputSize): number => {
  switch (size) {
    case 'xs':
      return 14
    case 'sm':
      return 16
    case 'lg':
    case 'xl':
      return 22
    default:
      return 18
  }
}

const renderIcon = (icon: IconType | ReactNode | undefined, iconSize: number): ReactNode => {
  if (!icon) return null
  if (typeof icon === 'function') {
    const IconComponent = icon as IconType
    return <IconComponent size={iconSize} />
  }
  return icon
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      labelPosition = 'inside',
      size,
      color,
      ghost = false,
      startIcon,
      endIcon,
      iconSize,
      helperText,
      error = false,
      success = false,
      datalist = [],
      wrapperClassName,
      containerClassName,
      className,
      id: _id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = _id || generatedId
    const resolvedIconSize = iconSize ?? getDefaultIconSize(size)
    const hasIcons = startIcon || endIcon
    const datalistId = datalist.length > 0 ? `${id}-datalist` : undefined

    // Build input classes based on state
    const inputBaseClasses = twMerge(
      'input w-full',
      size && `input-${size}`,
      error ? 'input-error' : success ? 'input-success' : color && `input-${color}`,
      ghost && 'input-ghost',
      disabled && 'input-disabled'
    )

    // Helper text styling
    const helperTextEl = helperText && (
      <p className={twMerge('label text-xs', error && 'text-error', success && 'text-success')}>
        {helperText}
      </p>
    )

    // Datalist element (reused)
    const datalistEl = datalist.length > 0 && (
      <datalist id={datalistId}>
        {datalist.map((option, index) => (
          <option key={index} value={option} />
        ))}
      </datalist>
    )

    // Core input element (reused with variations)
    const inputProps = {
      ref,
      id,
      type: 'text' as const,
      list: datalistId,
      disabled,
      ...props
    }

    // Floating label pattern
    // NOTE: In daisyUI 5.5+, the span MUST come before the input.
    // The label floats above when focused or has content, and appears inside when empty/unfocused.
    if (labelPosition === 'floating') {
      return (
        <div className={twMerge('form-control w-full', wrapperClassName)}>
          <label className={twMerge('floating-label w-full', containerClassName)}>
            {label && <span>{label}</span>}
            <input
              {...inputProps}
              placeholder={props.placeholder || label || ' '}
              className={twMerge(inputBaseClasses, className)}
            />
          </label>
          {helperTextEl}
          {datalistEl}
        </div>
      )
    }

    // Above label pattern
    if (labelPosition === 'above') {
      return (
        <div className={twMerge('form-control w-full', wrapperClassName)}>
          {label && (
            <label htmlFor={id} className="label">
              <span className="label-text text-base-content">{label}</span>
            </label>
          )}
          {hasIcons ? (
            <label
              className={twMerge(
                'input flex w-full items-center gap-2',
                size && `input-${size}`,
                error ? 'input-error' : success ? 'input-success' : color && `input-${color}`,
                ghost && 'input-ghost',
                disabled && 'input-disabled',
                containerClassName
              )}>
              {renderIcon(startIcon, resolvedIconSize)}
              <input
                {...inputProps}
                placeholder={props.placeholder || ' '}
                className={twMerge('grow bg-transparent focus:outline-none', className)}
              />
              {renderIcon(endIcon, resolvedIconSize)}
            </label>
          ) : (
            <input
              {...inputProps}
              placeholder={props.placeholder || ' '}
              className={twMerge(inputBaseClasses, className, containerClassName)}
            />
          )}
          {helperTextEl}
          {datalistEl}
        </div>
      )
    }

    // Inside label pattern (default) - label inside the input
    return (
      <div className={twMerge('form-control w-full', wrapperClassName)}>
        <label
          className={twMerge(
            'input flex w-full items-center gap-2',
            size && `input-${size}`,
            error ? 'input-error' : success ? 'input-success' : color && `input-${color}`,
            ghost && 'input-ghost',
            disabled && 'input-disabled',
            containerClassName
          )}>
          {renderIcon(startIcon, resolvedIconSize)}
          {label && <span className="label text-base-content/70">{label}</span>}
          <input
            {...inputProps}
            placeholder={props.placeholder || ' '}
            className={twMerge('grow bg-transparent focus:outline-none', className)}
          />
          {renderIcon(endIcon, resolvedIconSize)}
        </label>
        {helperTextEl}
        {datalistEl}
      </div>
    )
  }
)

TextInput.displayName = 'TextInput'

export default TextInput
