import React from 'react'
import { IoMdArrowDropdown } from 'react-icons/io'

// Define a type for the individual option
type OptionType = {
  value: string | number
  label: string
  className: string
}

// Define a type for the component props
type SelectBoxProps = {
  options: OptionType[]
  subOptions?: { summary: string; options: OptionType[] }
  value: OptionType | null
  onChange: (value: string) => void
  placeholder?: string
}

const SelectBox = ({ options, value, onChange, placeholder, subOptions }: SelectBoxProps) => {
  const handleClick = (event: React.MouseEvent<HTMLLIElement>) => {
    const targetValue = event.currentTarget.dataset.value as string
    onChange(targetValue)
    const elem = document.activeElement as HTMLElement
    if (elem) elem.blur()
  }

  function checkAndCloseDropDown(e: React.MouseEvent<HTMLDivElement>) {
    let targetEl = e.currentTarget
    if (targetEl && targetEl.matches(':focus')) {
      setTimeout(function () {
        targetEl.blur()
      }, 0)
    }
  }

  return (
    <div className="dropdown dropdown-bottom">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm m-1 group font-normal"
        onMouseDown={checkAndCloseDropDown}>
        {placeholder || value?.label}
        <div className="group-focus:rotate-180">
          <IoMdArrowDropdown />
        </div>
      </div>
      <div
        tabIndex={0}
        className="dropdown-content relative z-10 max-h-66 overflow-auto shadow rounded bg-base-100">
        <ul className="flex flex-col menu p-2 w-40">
          {options.map((option, index) => (
            <li
              key={index}
              onClick={handleClick}
              data-value={option.value}
              className="group-focus-visible/drop:bg-docsy">
              <a
                role="button"
                className={option.className + ` ${option.value === value?.value ? 'active' : ''}`}>
                {option.label}
              </a>
            </li>
          ))}
          {subOptions && (
            <li>
              <details open>
                <summary>{subOptions.summary}</summary>
                <ul>
                  {subOptions.options.map((option, index) => (
                    <li
                      key={index}
                      onClick={handleClick}
                      data-value={option.value}
                      className="group-focus-visible/drop:bg-docsy">
                      <a
                        role="button"
                        className={
                          option.className + ` ${option.value === value?.value ? 'active' : ''}`
                        }>
                        {option.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

export default React.memo(SelectBox)
