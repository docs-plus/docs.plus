import React from 'react'

const TableOfContentsLoader: React.FC<React.HTMLProps<HTMLDivElement>> = (props) => {
  return (
    <div {...props}>
      {/* Mirrors TocHeader's title row so the loader's first lines land where the
         real rows do */}
      <div className="mb-6 flex items-center justify-between pr-2 pl-4">
        <div className="skeleton h-5 w-32 rounded" />
        <div className="skeleton size-6 rounded" />
      </div>

      <div className="space-y-4">
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
