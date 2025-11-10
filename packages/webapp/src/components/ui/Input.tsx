import { forwardRef, useEffect, useState, InputHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { randstr } from '@utils/index'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** Label text for the input */
  label?: string
  /** Position of the label: 'before' or 'after' the input */
  labelPosition?: 'before' | 'after'
  /** Current input value */
  value?: string
  /** Custom ID for the input (generated if not provided) */
  id?: string
  /** Additional CSS classes */
  className?: string
  /** Change handler for the input */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Options for datalist */
  datalist?: string[]
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label = '',
      labelPosition = 'before',
      value = '',
      id: _id = '',
      className = '',
      onChange = () => {},
      datalist = [],
      ...props
    },
    ref
  ) => {
    const [id, setId] = useState(_id)

    useEffect(() => {
      if (!_id) setId(randstr('input-'))
    }, [_id])

    const containerClasses = twMerge('form-control relative', className)

    return (
      <div className={containerClasses}>
        <label
          className={twMerge(
            'input focus-within:border-primary focus-within:outline-primary w-full border border-gray-300 focus-within:outline',
            props.disabled ? 'input-disabled' : ''
          )}>
          {labelPosition === 'before' && label && <span className="label">{label}</span>}
          <input
            ref={ref}
            id={id}
            type="text"
            value={value || ''}
            onChange={onChange}
            placeholder={props.placeholder || ' '}
            list={datalist.length > 0 ? `${id}-datalist` : undefined}
            className="w-full focus:outline-none"
            {...props}
          />
          {labelPosition === 'after' && label && <span className="label">{label}</span>}
        </label>

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

Input.displayName = 'Input'

export default Input
