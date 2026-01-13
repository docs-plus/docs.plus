import React from 'react'

const TableOfContentsLoader: React.FC<React.HTMLProps<HTMLDivElement>> = (props) => {
  return (
    <div {...props}>
      {/* Title */}
      <div className="skeleton ml-4 h-5 w-32 rounded" />

      <div className="mt-8 space-y-4">
        {/* Section 1 */}
        <div className="skeleton ml-4 h-4 w-[70%] rounded" />
        <div className="space-y-2 pl-10">
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
        </div>

        {/* Section 2 */}
        <div className="skeleton ml-4 h-4 w-[65%] rounded" />
        <div className="space-y-2 pl-10">
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-3 w-2/3 rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
        </div>

        {/* Section 3 */}
        <div className="skeleton ml-4 h-4 w-[60%] rounded" />
        <div className="space-y-2 pl-10">
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
        </div>
      </div>
    </div>
  )
}

export default TableOfContentsLoader
