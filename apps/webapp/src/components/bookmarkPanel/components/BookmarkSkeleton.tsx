interface BookmarkSkeletonProps {
  count?: number
}

const BookmarkSkeletonItem = () => (
  <div className="rounded-box border-base-300 bg-base-100 flex w-full items-start gap-3 border p-3">
    <div className="skeleton size-9 shrink-0 rounded-full" />

    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <div className="skeleton h-4 w-28 rounded" />
      </div>

      <div className="mt-2">
        <div className="skeleton rounded-field h-8 w-full" />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-5 w-20 rounded" />
        <div className="skeleton ml-auto h-6 w-12 rounded" />
      </div>
    </div>
  </div>
)

export const BookmarkSkeleton = ({ count = 3 }: BookmarkSkeletonProps) => {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <BookmarkSkeletonItem key={index} />
      ))}
    </div>
  )
}
