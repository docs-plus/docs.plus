import React from 'react'
import PropTypes from 'prop-types'
import { Popover, PopoverTrigger, PopoverContent } from '@components/ui/Popover'
import { ArrowDown } from '@icons'

const SelectBox = React.forwardRef(({ options, value, onChange, placeholder }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false)

  const toggleOpsion = (option) => {
    setIsOpen(!isOpen)
    onChange(option.value)
  }

  const onOpenChange = (open) => {
    setIsOpen(open)
  }

  return (
    <Popover offcet={0} onOpenChange={onOpenChange} open={isOpen}>
      <PopoverTrigger asChild={true} ref={ref}>
        <span
          onClick={() => setIsOpen(!isOpen)}
          className="px-2 py-2 data-[state='open']:bg-slate-100  min-w-[150px] hover:bg-slate-100 flex items-center justify-around bg-white">
          <span>{placeholder || value.label}</span>
          <ArrowDown siz={16} className="ml-2" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="outline-none">
        <div className="bg-white border min-w-[150px] rounded-sm shadow-sm max-h-[280px] overflow-auto">
          {options.map((option, index) => (
            <div
              onClick={() => toggleOpsion(option)}
              key={index}
              value={option.value}
              className="py-2 px-2 pr-4 text-center antialiased hover:bg-slate-100 cursor-pointer  border-b border-gray-200">
              {option.label}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
})

// Prop Types for the component
SelectBox.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired
    })
  ).isRequired,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string
}

SelectBox.defaultProps = {
  value: ''
}

SelectBox.displayName = 'SelectBox'

export default SelectBox
