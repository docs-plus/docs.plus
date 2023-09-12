import React from 'react'
import PropTypes from 'prop-types'

// Styles for the select box (modify as needed)
const selectBoxStyle = {
  padding: '10px',
  fontSize: '16px',
  borderRadius: '4px',
  outline: 'none'
}

const SelectBox = React.forwardRef(({ options, value, onChange, placeholder, ...props }, ref) => {
  return (
    <select
      ref={ref}
      style={selectBoxStyle}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option, index) => (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string
}

SelectBox.defaultProps = {
  value: ''
}

SelectBox.displayName = 'SelectBox'

export default SelectBox
