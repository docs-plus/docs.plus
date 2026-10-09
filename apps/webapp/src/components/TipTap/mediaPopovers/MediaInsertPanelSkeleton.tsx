import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'

const MediaInsertPanelSkeleton = () => {
  return (
    <PanelSurfaceSkeleton tabCount={2}>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
        <div className="flex gap-1">
          <div className="skeleton rounded-field h-10 flex-1" />
          <div className="skeleton rounded-field h-10 w-20" />
        </div>
        <div className="skeleton rounded-box h-36 w-full" />
      </div>
    </PanelSurfaceSkeleton>
  )
}

export default MediaInsertPanelSkeleton
