import { twMerge } from 'tailwind-merge'

function randstr(prefix) {
  return Math.random()
    .toString(36)
    .replace('0.', prefix || '')
}

const Checkbox = ({ label, checked = false, disabled = false, id = randstr('checkbox_'), className }) => {
  return (
    <div className={twMerge(`flex align-middle items-center`, className)}>
      <input
        id={id}
        type="checkbox"
        value=""
        disabled={disabled}
        {...(checked ? { checked: true } : {})}
        className={`w-4 h-4 checked:accent-indigo-700 text-indigo-600 bg-gray-100 border-gray-300 rounded-md focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600`}
      />
      {label && (
        <label
          disabled={disabled}
          htmlFor={id}
          className={`ml-2 text-sm font-medium dark:text-gray-300 ${checked ? 'text-gray-500' : 'text-gray-900'}`}>
          {label}
        </label>
      )}
    </div>
  )
}

export default Checkbox
