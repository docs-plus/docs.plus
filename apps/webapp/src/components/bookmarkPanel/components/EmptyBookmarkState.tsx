import { LuBookmark } from 'react-icons/lu'

export const EmptyBookmarkState = ({ show }: { show: boolean }) => {
  if (!show) return null
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-8">
      <div className="bg-base-200 flex size-12 items-center justify-center rounded-full">
        <LuBookmark size={24} className="text-base-content/40" />
      </div>
      <div className="text-center">
        <p className="text-base-content/60 font-medium">No bookmarks here!</p>
        <p className="text-base-content/40 text-sm">
          Bookmarked messages will appear in this section.
        </p>
      </div>
    </div>
  )
}
