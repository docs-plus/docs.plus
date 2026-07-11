import React from 'react'

/** Pixel-locks to TocHeader + nested rows so S0→S1 does not jump. */
const TableOfContentsLoader: React.FC<React.HTMLProps<HTMLDivElement>> = (props) => {
  return (
    <div
      {...props}
      className={['flex h-full min-h-0 w-full flex-col', props.className]
        .filter(Boolean)
        .join(' ')}>
      <div
        className="border-base-300 relative isolate z-30 w-full shrink-0 border-b bg-[var(--pad-well)] pt-2 pb-1"
        style={{ paddingLeft: 'var(--toc-list-inset, 16px)' }}>
        <div className="rounded-field flex items-center gap-1 py-1 pr-3 pl-2">
          <div className="skeleton h-5 min-w-0 flex-1 rounded" />
          <div className="skeleton size-6 shrink-0 rounded" />
        </div>
      </div>

      <div className="space-y-1 px-0 pt-2" style={{ paddingLeft: 'var(--toc-list-inset, 16px)' }}>
        <div className="skeleton rounded-field h-8 w-[72%]" />
        <div className="space-y-1" style={{ paddingLeft: 'var(--toc-nest-indent, 16px)' }}>
          <div className="skeleton rounded-field h-8 w-[85%]" />
          <div className="skeleton rounded-field h-8 w-[78%]" />
          <div className="skeleton rounded-field h-8 w-[82%]" />
        </div>
        <div className="skeleton rounded-field mt-1 h-8 w-[65%]" />
        <div className="space-y-1" style={{ paddingLeft: 'var(--toc-nest-indent, 16px)' }}>
          <div className="skeleton rounded-field h-8 w-[80%]" />
          <div className="skeleton rounded-field h-8 w-[70%]" />
        </div>
        <div className="skeleton rounded-field mt-1 h-8 w-[60%]" />
        <div className="space-y-1" style={{ paddingLeft: 'var(--toc-nest-indent, 16px)' }}>
          <div className="skeleton rounded-field h-8 w-[75%]" />
          <div
            className="skeleton rounded-field h-8 w-[68%]"
            style={{ marginLeft: 'var(--toc-nest-indent, 16px)' }}
          />
        </div>
      </div>
    </div>
  )
}

export default TableOfContentsLoader
