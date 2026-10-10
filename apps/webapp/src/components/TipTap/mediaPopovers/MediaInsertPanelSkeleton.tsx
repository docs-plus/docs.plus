import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'

/** The panel opens on Embed URL, so the body is only the URL field joined to Insert. */
const MediaInsertPanelSkeleton = () => {
  return (
    <PanelSurfaceSkeleton tabCount={2}>
      <div className="flex p-3">
        <div className="skeleton rounded-field h-10 flex-1 rounded-r-none" />
        <div className="skeleton rounded-field h-10 w-20 rounded-l-none" />
      </div>
    </PanelSurfaceSkeleton>
  )
}

export default MediaInsertPanelSkeleton
