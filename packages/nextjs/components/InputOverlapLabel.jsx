import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { randstr } from '@utils/index'
import { useEffect, useState } from 'react'

const InputOverlapLabel = forwardRef(
  ({
    label,
    value = '',
    id: _id = '',
    Icon,
    fill = 'rgb(104, 81, 255)',
    size = 18,
    className = '',
    onChange = () => {},
    rows = '1',
    cols = '1',
    ...props
  }) => {
    const [id, setId] = useState(_id)

    useEffect(() => {
      if (!_id) setId(randstr('input-'))
    }, [])

    const containerClasses = twMerge(
      `relative border subpixel-antialiased rounded-md flex align-middle justify-start ${!Icon ? 'pl-2' : ''}`,
      className
    )

    const iconContainerClasses = `border-r rounded-l-md w-12 flex align-middle justify-center items-center ${
      props.disabled ? 'bg-slate-200 dark:bg-slate-800 border-gray-400' : 'bg-white dark:bg-slate-900'
    }`

    const labelClasses = `cursor-text absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-[1.1rem] left-1 ${
      Icon ? 'ml-10' : ''
    }`

    return (
      <div className={containerClasses}>
        {Icon && (
          <span className={iconContainerClasses}>
            <Icon size={size} fill={fill} />
          </span>
        )}
        <input
          id={id}
          type="text"
          value={value}
          onChange={onChange}
          placeholder=" "
          className="block p-2 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 disabled:rounded-none disabled:bg-slate-200 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
          {...props}
        />
        <label htmlFor={id} className={labelClasses}>
          {label}
        </label>
      </div>
    )
  }
)

InputOverlapLabel.displayName = 'InputOverlapLabel'

export default InputOverlapLabel
