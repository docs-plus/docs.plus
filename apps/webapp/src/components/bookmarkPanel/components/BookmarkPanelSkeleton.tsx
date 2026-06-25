import { BookmarkSkeleton } from './BookmarkSkeleton'

export const BookmarkPanelSkeleton = () => {
  return (
    <div className="bg-base-100 flex w-full flex-col">
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <div className="skeleton h-6 w-24 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>
      <div className="border-base-300 flex gap-2 border-b px-4 py-2">
        <div className="skeleton rounded-field h-8 w-28" />
        <div className="skeleton rounded-field h-8 w-24" />
        <div className="skeleton rounded-field h-8 w-16" />
      </div>
      <div className="p-3">
        <BookmarkSkeleton count={3} />
      </div>
    </div>
  )
}

export default BookmarkPanelSkeleton
