import React from 'react'

type TProps = {
  level?: string
  className?: string
}

const DocumentWithPictureLoader: React.FC<React.HTMLProps<HTMLDivElement> & TProps> = (props) => {
  const { level, className, ...rest } = props

  return (
    <div className={className} {...rest}>
      {/* Heading */}
      <div className="skeleton mb-3 h-7 w-3/5 rounded" />

      {/* Meta info */}
      <div className="mb-4 flex gap-6">
        <div className="skeleton h-4 w-16 rounded" />
        <div className="skeleton h-4 w-28 rounded" />
      </div>

      {/* Content with image */}
      <div className="space-y-3 pl-4">
        <div className="skeleton h-4 w-[94%] rounded" />
        <div className="skeleton h-4 w-[40%] rounded" />

        {/* Image with text */}
        <div className="flex gap-4 py-2">
          <div className="skeleton bg-neutral/30 size-32 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-3">
            <div className="skeleton bg-neutral/20 h-4 w-[78%] rounded" />
            <div className="skeleton bg-neutral/20 h-4 w-[58%] rounded" />
            <div className="skeleton bg-neutral/20 h-4 w-[72%] rounded" />
            <div className="skeleton bg-neutral/20 h-4 w-[30%] rounded" />
          </div>
        </div>

        <div className="skeleton h-4 w-[78%] rounded" />
        <div className="skeleton h-4 w-[94%] rounded" />
        <div className="skeleton h-4 w-[70%] rounded" />
        <div className="skeleton h-4 w-[88%] rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </div>
  )
}

export default DocumentWithPictureLoader
