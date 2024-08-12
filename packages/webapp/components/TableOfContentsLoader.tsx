import React from 'react'

const TableOfcontentLoader: React.FC<React.HTMLProps<HTMLDivElement>> = (props) => {
  return (
    <div {...props}>
      <div className="skeleton ml-4 mt-3 h-6 w-[54%] rounded"></div>
      <div className="my-8"></div>
      <div className="skeleton ml-4 mt-3 h-4 w-[70%] rounded"></div>
      <div className="ml-10">
        <div className="skeleton ml-4 mt-3 h-4 w-4/5 rounded"></div>
        <div className="skeleton ml-4 mt-3 h-4 w-4/5 rounded"></div>
        <div className="skeleton ml-4 mt-3 h-4 w-4/5 rounded"></div>
      </div>
      <div className="skeleton ml-4 mt-3 h-4 w-[70%] rounded"></div>
      <div className="ml-10">
        <div className="skeleton ml-4 mt-3 h-4 w-4/5 rounded"></div>
        <div className="skeleton ml-4 mt-3 h-4 w-4/5 rounded"></div>
        <div className="skeleton ml-4 mt-3 h-4 w-4/5 rounded"></div>
      </div>
    </div>
  )
}

export default TableOfcontentLoader
