import { forwardRef, useEffect, useState, InputHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { randstr } from '@utils/index'

export interface InputOverlapLabelProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** Label text for the input */
  label?: string
  /** Current input value */
  value?: string
  /** Custom ID for the input (generated if not provided) */
  id?: string
  /** Icon component to display */
  Icon?: React.ComponentType<{ size?: number; fill?: string }>
  /** Fill color for the icon */
  fill?: string
  /** Size of the icon */
  size?: number
  /** Additional CSS classes */
  className?: string
  /** Change handler for the input */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Options for datalist */
  datalist?: string[]
  /** Error state for validation */
  error?: boolean
}

const InputOverlapLabel = forwardRef<HTMLInputElement, InputOverlapLabelProps>(
  (
    {
      label = '',
      value = '',
      id: _id = '',
      Icon = null,
      fill = 'rgb(104, 81, 255)',
      size = 18,
      className = '',
      onChange = () => {},
      datalist = [],
      error,
      ...props
    },
    ref
  ) => {
    const [id, setId] = useState(_id)

    useEffect(() => {
      if (!_id) setId(randstr('input-'))
    }, [_id])

    // Using Daisy UI classes
    const containerClasses = twMerge('form-control relative', className)

    // Determine border and outline colors based on error state
    const borderColorClasses =
      error === true
        ? 'border-red-500 focus:border-red-500 focus:outline-red-500 group-focus-within:border-red-500 group-focus-within:outline-red-500'
        : error === false
          ? 'border-green-500 focus:border-green-500 focus:outline-green-500 group-focus-within:border-green-500 group-focus-within:outline-green-500'
          : 'border-gray-300 focus:border-primary focus:outline-primary group-focus-within:border-primary group-focus-within:outline-primary'

    return (
      <div className={containerClasses}>
        {Icon ? (
          <div className="join group relative w-full">
            <label
              htmlFor={id}
              className={twMerge(
                'join-item flex items-center justify-center border border-r-0 px-3',
                borderColorClasses,
                props.disabled ? 'bg-base-200' : 'bg-base-100',
                !props.disabled && 'cursor-pointer'
              )}>
              <Icon size={size} fill={fill} />
            </label>
            <label className="floating-label join-item flex-1">
              <span className="text-black">{label}</span>
              <input
                ref={ref}
                id={id}
                type="text"
                value={value || ''}
                onChange={onChange}
                placeholder=" "
                list={datalist.length > 0 ? `${id}-datalist` : undefined}
                className={twMerge(
                  'input input-md w-full',
                  borderColorClasses,
                  'rounded-l-none',
                  props.disabled ? 'input-disabled' : ''
                )}
                {...props}
              />
            </label>
          </div>
        ) : (
          <label className="floating-label w-full">
            <span>{label}</span>
            <input
              ref={ref}
              id={id}
              type="text"
              value={value || ''}
              onChange={onChange}
              placeholder=" "
              list={datalist.length > 0 ? `${id}-datalist` : undefined}
              className={twMerge(
                'input input-md w-full',
                borderColorClasses,
                props.disabled ? 'input-disabled' : ''
              )}
              {...props}
            />
          </label>
        )}

        {datalist.length > 0 && (
          <datalist id={`${id}-datalist`}>
            {datalist.map((option: string, index: number) => (
              <option key={index} value={option} />
            ))}
          </datalist>
        )}
      </div>
    )
  }
)

InputOverlapLabel.displayName = 'InputOverlapLabel'

export default InputOverlapLabel
