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
      <div className="skeleton h-7 w-[54%] mt-3"></div>
      <div className="flex space-x-10">
        <div className="skeleton h-5 w-[12%] mt-3"></div>
        <div className="skeleton h-5 w-[32%] mt-3"></div>
      </div>
      <div className="ml-6 mt-6">
        <div className="skeleton h-5 w-[94%] mt-3"></div>
        <div className="skeleton h-5 w-[30%] mt-3"></div>
        <div className="flex  mt-3">
          <div className="skeleton bg-neutral w-40 h-34"></div>
          <div className="float-left w-full ml-4">
            <div className="skeleton bg-neutral h-5 w-[78%] "></div>
            <div className="skeleton bg-neutral h-5 w-[58%] mt-3"></div>
            <div className="skeleton bg-neutral h-5 w-[78%] mt-3"></div>
            <div className="skeleton bg-neutral h-5 w-[28%] mt-3"></div>
          </div>
        </div>
        <div className="skeleton h-5 w-[78%] mt-3"></div>
        <div className="skeleton h-5 w-[94%] mt-3"></div>
        <div className="skeleton h-5 w-[78%] mt-3"></div>
        <div className="skeleton h-5 w-[94%] mt-3"></div>
        <div className="skeleton h-5 w-[52%] mt-3"></div>
      </div>
    </div>
  )
}

export default DocumentWithPictureLoader
