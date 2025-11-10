import { twMerge } from 'tailwind-merge'
import { randstr } from '@utils/index'
import { ChangeEvent } from 'react'

interface CheckboxProps {
  label?: string
  checked?: boolean
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  id?: string
  className?: string
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked = false,
  onChange = () => {},
  disabled = false,
  id = randstr('checkbox_'),
  className
}) => {
  return (
    <div className={twMerge(`flex items-center align-middle`, className)}>
      <input
        id={id}
        type="checkbox"
        onChange={onChange}
        disabled={disabled}
        checked={checked}
        className={`size-4 rounded-md border-gray-300 bg-gray-100 text-indigo-600 checked:accent-indigo-700 focus:ring-2 focus:ring-indigo-500`}
      />
      {label && (
        <label
          htmlFor={id}
          className={`ml-2 text-sm font-medium ${
            checked ? 'text-gray-500' : 'text-gray-900'
          } ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </label>
      )}
    </div>
  )
}

export default Checkbox
