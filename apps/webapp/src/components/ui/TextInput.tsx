import { twMerge } from '@utils/twMerge'
import { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react'
import { IconType } from 'react-icons'

import { FieldHelp, fieldLabelClassName } from './FieldHelp'

export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type InputColor =
  'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  labelPosition?: 'inside' | 'floating' | 'above'
  size?: InputSize
  color?: InputColor
  ghost?: boolean
  startIcon?: IconType | ReactNode
  endIcon?: IconType | ReactNode
  iconSize?: number
  labelClassName?: string
  /** Help line under the field. With `error`, it renders as the error line. */
  helperText?: string
  error?: boolean
  success?: boolean
  datalist?: string[]
  wrapperClassName?: string
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
      labelClassName,
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

    const inputBaseClasses = twMerge(
      'input w-full',
      size && `input-${size}`,
      error ? 'input-error' : success ? 'input-success' : color && `input-${color}`,
      ghost && 'input-ghost',
      disabled && 'input-disabled'
    )

    const helperId = helperText ? `${id}-help` : undefined
    const describedBy = [props['aria-describedby'], helperId].filter(Boolean).join(' ') || undefined

    const helperTextEl = helperText && (
      <FieldHelp id={helperId} error={error} success={success}>
        {helperText}
      </FieldHelp>
    )

    const datalistEl = datalist.length > 0 && (
      <datalist id={datalistId}>
        {datalist.map((option, index) => (
          <option key={index} value={option} />
        ))}
      </datalist>
    )

    const inputProps = {
      ref,
      id,
      type: 'text' as const,
      list: datalistId,
      disabled,
      ...props,
      'aria-invalid': props['aria-invalid'] ?? (error || undefined),
      'aria-describedby': describedBy
    }

    // daisyUI 5.5+: the span MUST come before the input or the label never floats.
    if (labelPosition === 'floating') {
      return (
        <div className={twMerge('flex w-full flex-col gap-1.5', wrapperClassName)}>
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

    if (labelPosition === 'above') {
      return (
        <div className={twMerge('flex w-full flex-col gap-1.5', wrapperClassName)}>
          {label && (
            <label htmlFor={id} className={twMerge(fieldLabelClassName, labelClassName)}>
              {label}
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

    return (
      <div className={twMerge('flex w-full flex-col gap-1.5', wrapperClassName)}>
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
          {label && (
            <span className={twMerge('label text-base-content/70', labelClassName)}>{label}</span>
          )}
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
