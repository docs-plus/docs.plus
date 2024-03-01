import React from 'react'

// Using React.HTMLProps<HTMLDivElement> for general div props
const TableOfcontentLoader: React.FC<React.HTMLProps<HTMLDivElement>> = (props) => {
  return (
    <div {...props}>
      <div className="skeleton h-6 w-[54%] ml-4 mt-3 rounded"></div>
      <div className="my-8"></div>
      <div className="skeleton h-4 w-[70%] ml-4 mt-3 rounded"></div>
      <div className="ml-10">
        <div className="skeleton h-4 w-[80%] ml-4 mt-3 rounded"></div>
        <div className="skeleton h-4 w-[80%] ml-4 mt-3 rounded"></div>
        <div className="skeleton h-4 w-[80%] ml-4 mt-3 rounded"></div>
      </div>
      <div className="skeleton h-4 w-[70%] ml-4 mt-3 rounded"></div>
      <div className="ml-10">
        <div className="skeleton h-4 w-[80%] ml-4 mt-3 rounded"></div>
        <div className="skeleton h-4 w-[80%] ml-4 mt-3 rounded"></div>
        <div className="skeleton h-4 w-[80%] ml-4 mt-3 rounded"></div>
      </div>
    </div>
  )
}

export default TableOfcontentLoader
