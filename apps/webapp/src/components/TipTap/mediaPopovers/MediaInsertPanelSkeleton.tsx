/** Geometry-true bones for the media-insert popover: tab bar + URL field + dropzone. */
const MediaInsertPanelSkeleton = () => {
  return (
    <div className="flex w-full flex-col">
      <div className="px-4 py-2.5">
        <div className="bg-base-300 rounded-box flex w-full gap-1 p-1">
          <div className="skeleton rounded-field h-9 flex-1" />
          <div className="skeleton rounded-field h-9 flex-1" />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
        <div className="flex gap-1">
          <div className="skeleton rounded-field h-10 flex-1" />
          <div className="skeleton rounded-field h-10 w-20" />
        </div>
        <div className="skeleton rounded-box h-36 w-full" />
      </div>
    </div>
  )
}

export default MediaInsertPanelSkeleton
