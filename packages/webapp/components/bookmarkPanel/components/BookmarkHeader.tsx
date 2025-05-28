import { BsBookmarkFill } from 'react-icons/bs'

export const BookmarkHeader = () => {
  return (
    <div className="flex items-center justify-between">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <BsBookmarkFill size={20} />
        Bookmarks
      </h1>
    </div>
  )
}
