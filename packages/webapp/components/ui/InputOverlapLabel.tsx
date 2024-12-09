import { forwardRef, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { randstr } from '@utils/index'

const InputOverlapLabel = forwardRef(
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
      ...props
    }: any,
    ref
  ) => {
    const [id, setId] = useState(_id)

    useEffect(() => {
      if (!_id) setId(randstr('input-'))
    }, [])

    const containerClasses = twMerge(
      `relative border subpixel-antialiased rounded-md flex align-middle justify-start ${
        !Icon ? 'pl-2' : ''
      }`,
      className
    )

    const iconContainerClasses = `border-r rounded-l-md w-12 flex align-middle justify-center items-center ${
      props.disabled
        ? 'bg-slate-200 dark:bg-slate-800 border-gray-400'
        : 'bg-white dark:bg-slate-900'
    }`

    const labelClasses = `cursor-text inline-block absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-[1.1rem] left-1 ${
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
          ref={ref}
          id={id}
          type="text"
          value={value || ''}
          onChange={onChange}
          placeholder=" "
          list={datalist.length > 0 ? `${id}-datalist` : undefined}
          className="border-1 peer block w-full appearance-none rounded-lg border-gray-300 bg-transparent p-2 pt-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0 disabled:rounded-none disabled:bg-slate-200 dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
          {...props}
        />

        {datalist.length > 0 && (
          <datalist id={`${id}-datalist`}>
            {datalist.map((option: string, index: number) => (
              <option key={index} value={option} />
            ))}
          </datalist>
        )}

        <label htmlFor={id} className={labelClasses}>
          {label}
        </label>
      </div>
    )
  }
)

InputOverlapLabel.displayName = 'InputOverlapLabel'

export default InputOverlapLabel
