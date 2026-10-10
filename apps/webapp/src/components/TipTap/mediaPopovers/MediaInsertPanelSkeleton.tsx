import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'

/** The panel opens on Embed URL, so the body is only the URL field joined to Insert. */
const MediaInsertPanelSkeleton = () => {
  return (
    <PanelSurfaceSkeleton tabCount={2}>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex w-full">
          <div className="skeleton rounded-field h-10 flex-1 rounded-r-none" />
          <div className="skeleton rounded-field h-10 w-20 rounded-l-none" />
        </div>
      </div>
    </PanelSurfaceSkeleton>
  )
}

export default MediaInsertPanelSkeleton
