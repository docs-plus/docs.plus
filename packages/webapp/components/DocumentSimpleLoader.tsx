import React from 'react'

type TProps = {
  level: string
  className: string
}

const DocumentSimpleLoader: React.FC<React.HTMLProps<HTMLDivElement> & TProps> = (props) => {
  return (
    <div {...props}>
      <div className="skeleton h-7 w-[54%] mt-3 rounded"></div>
      <div className="flex space-x-10">
        <div className="skeleton h-5 w-[12%] mt-3 rounded"></div>
        <div className="skeleton h-5 w-[32%] mt-3 rounded"></div>
      </div>
      <div className="ml-6 mt-6">
        <div className="skeleton h-5 w-[94%] mt-3 rounded"></div>
        <div className="skeleton h-5 w-[30%] mt-3 rounded"></div>
        <div className="flex space-x-8">
          <div className="skeleton bg-docsy h-5 w-[20%] mt-3 rounded"></div>
          <div className="skeleton bg-docsy h-5 w-[16%] mt-3 rounded"></div>
          <div className="skeleton bg-docsy h-5 w-[54%] mt-3 rounded"></div>
        </div>
        <div className="skeleton h-5 w-[78%] mt-3 rounded"></div>
        <div className="skeleton h-5 w-[94%] mt-3 rounded"></div>
        <div className="skeleton h-5 w-[78%] mt-3 rounded"></div>
        <div className="skeleton h-5 w-[94%] mt-3 rounded"></div>
        <div className="skeleton h-5 w-[52%] mt-3 rounded"></div>
      </div>
    </div>
  )
}

export default DocumentSimpleLoader
