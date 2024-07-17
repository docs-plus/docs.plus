import React from 'react'

type TProps = {
  level: string
  className: string
}

const DocumentSimpleLoader: React.FC<React.HTMLProps<HTMLDivElement> & TProps> = (props) => {
  return (
    <div {...props}>
      <div className="skeleton mt-3 h-7 w-[54%] rounded"></div>
      <div className="flex space-x-10">
        <div className="skeleton mt-3 h-5 w-[12%] rounded"></div>
        <div className="skeleton mt-3 h-5 w-[32%] rounded"></div>
      </div>
      <div className="ml-6 mt-6">
        <div className="skeleton mt-3 h-5 w-[94%] rounded"></div>
        <div className="skeleton mt-3 h-5 w-[30%] rounded"></div>
        <div className="flex space-x-8">
          <div className="skeleton mt-3 h-5 w-1/5 rounded bg-docsy opacity-60"></div>
          <div className="skeleton mt-3 h-5 w-[16%] rounded bg-docsy opacity-60"></div>
          <div className="skeleton mt-3 h-5 w-[54%] rounded bg-docsy opacity-60"></div>
        </div>
        <div className="skeleton mt-3 h-5 w-[78%] rounded"></div>
        <div className="skeleton mt-3 h-5 w-[94%] rounded"></div>
        <div className="skeleton mt-3 h-5 w-[78%] rounded"></div>
        <div className="skeleton mt-3 h-5 w-[94%] rounded"></div>
        <div className="skeleton mt-3 h-5 w-[52%] rounded"></div>
      </div>
    </div>
  )
}

export default DocumentSimpleLoader
