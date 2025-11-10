import { BsBookmark } from 'react-icons/bs'

export const EmptyBookmarkState = ({ show }: { show: boolean }) => {
  if (!show) return null
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-8">
      <div className="rounded-full bg-gray-100 p-3">
        <BsBookmark size={24} className="text-gray-400" />
      </div>
      <div className="text-center">
        <p className="text-gray-600">No bookmarks here!</p>
        <p className="text-sm text-gray-500">Bookmarked messages will appear in this section.</p>
      </div>
    </div>
  )
}
