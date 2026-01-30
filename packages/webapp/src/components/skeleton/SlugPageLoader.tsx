import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'

// Skeleton line component for consistent styling
const SkeletonLine = ({
  width = 'w-full',
  height = 'h-4'
}: {
  width?: string
  height?: string
}) => <div className={`skeleton rounded ${width} ${height}`} />

// Skeleton for heading with subtext
const HeadingSkeleton = () => (
  <div className="mb-6">
    <SkeletonLine width="w-3/5" height="h-7" />
    <div className="mt-3 flex gap-4">
      <SkeletonLine width="w-16" height="h-4" />
      <SkeletonLine width="w-24" height="h-4" />
    </div>
  </div>
)

// Skeleton for paragraph content
const ParagraphSkeleton = ({ lines = 5 }: { lines?: number }) => (
  <div className="mb-6 space-y-3 pl-4">
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonLine key={i} width={i === lines - 1 ? 'w-3/5' : i % 2 === 0 ? 'w-full' : 'w-4/5'} />
    ))}
  </div>
)

// Skeleton for content with image
const ContentWithImageSkeleton = () => (
  <div className="mb-6 pl-4">
    <div className="flex gap-4">
      <div className="skeleton size-32 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-3">
        <SkeletonLine width="w-4/5" />
        <SkeletonLine width="w-3/5" />
        <SkeletonLine width="w-4/5" />
        <SkeletonLine width="w-2/5" />
      </div>
    </div>
  </div>
)

// Table of contents skeleton - extended for large screens
const TableOfContentsSkeleton = () => (
  <div className="space-y-4 p-4">
    <SkeletonLine width="w-32" height="h-5" />
    <div className="mt-6 space-y-3">
      {/* Section 1 */}
      <SkeletonLine width="w-4/5" />
      <div className="space-y-2 pl-4">
        <SkeletonLine width="w-3/4" height="h-3" />
        <SkeletonLine width="w-3/4" height="h-3" />
        <SkeletonLine width="w-2/3" height="h-3" />
      </div>
      {/* Section 2 */}
      <SkeletonLine width="w-4/5" />
      <div className="space-y-2 pl-4">
        <SkeletonLine width="w-3/4" height="h-3" />
        <SkeletonLine width="w-2/3" height="h-3" />
      </div>
      {/* Section 3 */}
      <SkeletonLine width="w-3/4" />
      <div className="space-y-2 pl-4">
        <SkeletonLine width="w-2/3" height="h-3" />
        <SkeletonLine width="w-3/4" height="h-3" />
        <SkeletonLine width="w-1/2" height="h-3" />
      </div>
      {/* Section 4 */}
      <SkeletonLine width="w-4/5" />
      <div className="space-y-2 pl-4">
        <SkeletonLine width="w-2/3" height="h-3" />
        <SkeletonLine width="w-3/4" height="h-3" />
      </div>
      {/* Section 5 */}
      <SkeletonLine width="w-3/5" />
      <div className="space-y-2 pl-4">
        <SkeletonLine width="w-3/4" height="h-3" />
        <SkeletonLine width="w-2/3" height="h-3" />
        <SkeletonLine width="w-1/2" height="h-3" />
      </div>
    </div>
  </div>
)

// Toolbar skeleton
const ToolbarSkeleton = () => (
  <div className="border-base-300 bg-base-100 flex items-center gap-2 border-b px-4 py-2">
    <SkeletonLine width="w-24" height="h-6" />
    <div className="bg-base-300 mx-2 h-5 w-px" />
    <div className="flex gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton size-7 rounded" />
      ))}
    </div>
    <div className="bg-base-300 mx-2 h-5 w-px" />
    <div className="flex gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton size-7 rounded" />
      ))}
    </div>
    <div className="ml-auto flex gap-1">
      {[1, 2].map((i) => (
        <div key={i} className="skeleton size-7 rounded" />
      ))}
    </div>
  </div>
)

// Header skeleton
const HeaderSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div className="border-base-300 bg-base-100 flex items-center justify-between border-b px-4 py-3">
    <div className="flex items-center gap-3">
      {!isMobile && <div className="skeleton size-8 rounded" />}
      <SkeletonLine width="w-32" height="h-5" />
    </div>
    <div className="flex items-center gap-2">
      {!isMobile && <SkeletonLine width="w-20" height="h-8" />}
      <div className="skeleton size-9 rounded-full" />
    </div>
  </div>
)

// Document content skeleton - fills viewport on large screens
const DocumentSkeleton = () => (
  <div className="mx-auto max-w-3xl px-4 py-6">
    {/* Section 1 */}
    <HeadingSkeleton />
    <ParagraphSkeleton lines={4} />

    {/* Section 2 with image */}
    <HeadingSkeleton />
    <ParagraphSkeleton lines={3} />
    <ContentWithImageSkeleton />
    <ParagraphSkeleton lines={3} />

    {/* Section 3 */}
    <HeadingSkeleton />
    <ParagraphSkeleton lines={5} />

    {/* Section 4 - additional content for large screens */}
    <HeadingSkeleton />
    <ParagraphSkeleton lines={4} />

    {/* Section 5 - more content for tall viewports */}
    <HeadingSkeleton />
    <ParagraphSkeleton lines={3} />
    <ContentWithImageSkeleton />
    <ParagraphSkeleton lines={4} />
  </div>
)

// Loading status toast - simple and clean
const LoadingToast = ({
  loading,
  providerSyncing,
  loadingPage
}: {
  loading: boolean
  providerSyncing: boolean
  loadingPage: boolean
}) => {
  const getMessage = () => {
    if (loading) return 'Fetching profile data'
    if (providerSyncing) return 'Syncing document'
    if (loadingPage) return 'Loading components'
    return 'Loading'
  }

  return (
    <div className="bg-neutral text-neutral-content fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg">
      <span className="loading loading-spinner loading-sm" />
      <span>{getMessage()}...</span>
    </div>
  )
}

export const SlugPageLoader = ({
  loading = false,
  providerSyncing = false,
  loadingPage = false
}: {
  loading?: boolean
  providerSyncing?: boolean
  loadingPage?: boolean
}) => {
  const isMobile = useStore((state) => state.settings.editor.isMobile) ?? false

  return (
    <div className="bg-base-200 flex h-full min-h-screen flex-col">
      {/* Header */}
      <HeaderSkeleton isMobile={isMobile} />

      {/* Toolbar - desktop only */}
      {!isMobile && <ToolbarSkeleton />}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table of Contents - desktop only */}
        {!isMobile && (
          <aside className="border-base-300 bg-base-100 hidden w-64 shrink-0 border-r md:block">
            <TableOfContentsSkeleton />
          </aside>
        )}

        {/* Document content */}
        <ScrollArea className="bg-base-100 flex-1" orientation="vertical">
          <DocumentSkeleton />
        </ScrollArea>
      </div>

      {/* Loading toast */}
      <LoadingToast loading={loading} providerSyncing={providerSyncing} loadingPage={loadingPage} />
    </div>
  )
}
