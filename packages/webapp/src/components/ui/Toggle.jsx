import React from 'react'
import { randstr } from '@utils/index'

const Toggle = ({ id, checked = false, value = '', onChange = () => {} }) => {
  const toggleId = id || randstr('toggle_')

  return (
    <label className="relative inline-flex cursor-pointer items-center" htmlFor={toggleId}>
      <input
        type="checkbox"
        onChange={onChange}
        checked={checked}
        value={value}
        className="peer sr-only"
        id={toggleId}
      />
      <div
        className={`
        peer-focus:ring-Indigo-300 dark:peer-focus:ring-Indigo-800 peer h-3 w-12 rounded-full bg-gray-200 before:absolute before:-top-px before:left-14 before:text-xs before:font-bold
        before:content-['OFF']
        after:absolute
        after:left-[4px]
        after:top-[-4px]
        after:size-5
        after:rounded-md
        after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-300 peer-checked:before:content-['ON'] peer-checked:after:translate-x-full peer-checked:after:border-none peer-checked:after:border-white peer-checked:after:bg-indigo-600 peer-checked:after:drop-shadow-md peer-focus:outline-none peer-focus:ring-4 dark:border-gray-600 dark:bg-gray-700
      `}></div>
    </label>
  )
}

export default Toggle
