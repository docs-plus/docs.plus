import React from 'react'
import { randstr } from '@utils/index'

const Toggle = ({ id, checked = false, value = '', onChange = () => {} }) => {
  const toggleId = id || randstr('toggle_')

  return (
    <label className="relative inline-flex items-center cursor-pointer" htmlFor={toggleId}>
      <input
        type="checkbox"
        onChange={onChange}
        checked={checked}
        value={value}
        className="sr-only peer"
        id={toggleId}
      />
      <div
        className={`
        w-12 h-3 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-Indigo-300 dark:peer-focus:ring-Indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white
        before:absolute
        before:left-14
        before:-top-[1px]
        before:text-xs
        before:font-bold
        before:content-['OFF']
        peer-checked:before:content-['ON'] after:content-[''] after:absolute after:top-[-4px] after:left-[4px] peer-checked:after:bg-indigo-600 peer-checked:after:drop-shadow-md peer-checked:after:border-none after:bg-white after:border-gray-300 after:border after:rounded-md after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-300
      `}></div>
    </label>
  )
}

export default Toggle
