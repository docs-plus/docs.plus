import React from 'react'

type TProps = {
  level: string
  className: string
}

// Using React.HTMLProps<HTMLDivElement> for general div props
const DocumentWithPictureLoader: React.FC<React.HTMLProps<HTMLDivElement> & TProps> = (
  props: TProps
) => {
  return (
    <div {...props}>
      <div className="skeleton mt-3 h-7 w-[54%]"></div>
      <div className="flex space-x-10">
        <div className="skeleton mt-3 h-5 w-[12%]"></div>
        <div className="skeleton mt-3 h-5 w-[32%]"></div>
      </div>
      <div className="ml-6 mt-6">
        <div className="skeleton mt-3 h-5 w-[94%]"></div>
        <div className="skeleton mt-3 h-5 w-[30%]"></div>
        <div className="mt-3  flex">
          <div className="skeleton h-36 w-40 bg-neutral"></div>
          <div className="float-left ml-4 w-full">
            <div className="skeleton h-5 w-[78%] bg-neutral "></div>
            <div className="skeleton mt-3 h-5 w-[58%] bg-neutral"></div>
            <div className="skeleton mt-3 h-5 w-[78%] bg-neutral"></div>
            <div className="skeleton mt-3 h-5 w-[28%] bg-neutral"></div>
          </div>
        </div>
        <div className="skeleton mt-3 h-5 w-[78%]"></div>
        <div className="skeleton mt-3 h-5 w-[94%]"></div>
        <div className="skeleton mt-3 h-5 w-[78%]"></div>
        <div className="skeleton mt-3 h-5 w-[94%]"></div>
        <div className="skeleton mt-3 h-5 w-[52%]"></div>
      </div>
    </div>
  )
}

export default DocumentWithPictureLoader
