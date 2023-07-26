import React from 'react'

const ToolbarButton = ({ type, editor, onClick, children }) => {
  const buttonClass = editor?.isActive(type) ? 'is-active' : ''

  return (
    <button className={buttonClass} onClick={onClick}>
      {children}
    </button>
  )
}

export default ToolbarButton
