import { twMerge } from 'tailwind-merge'
import { randstr } from '@utils/index'

const Checkbox = ({
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
        className={`size-4 rounded-md border-gray-300 bg-gray-100 text-indigo-600 checked:accent-indigo-700 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-indigo-600`}
      />
      {label && (
        <label
          disabled={disabled}
          htmlFor={id}
          className={`ml-2 text-sm font-medium dark:text-gray-300 ${
            checked ? 'text-gray-500' : 'text-gray-900'
          }`}>
          {label}
        </label>
      )}
    </div>
  )
}

export default Checkbox
