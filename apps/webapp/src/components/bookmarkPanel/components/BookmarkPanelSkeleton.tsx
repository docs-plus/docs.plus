import { PanelFeedSkeleton } from '@components/PanelFeedSkeleton'
import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'

export const BookmarkPanelSkeleton = () => (
  <PanelSurfaceSkeleton tabCount={3}>
    <div className="max-h-96 min-h-48 overflow-hidden p-3">
      <PanelFeedSkeleton count={4} />
    </div>
  </PanelSurfaceSkeleton>
)
