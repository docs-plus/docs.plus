import { BookmarkPanel as BookmarkPanelContent } from '@components/bookmarkPanel'
import { twMerge } from 'tailwind-merge'

interface BookmarkPanelProps {
  className?: string
  onClose?: () => void
}

const BookmarkPanel = ({ className = '', onClose }: BookmarkPanelProps) => {
  return (
    <div className={twMerge('bg-base-100 flex w-full flex-col', className)}>
      <BookmarkPanelContent onClose={onClose} />
    </div>
  )
}

export default BookmarkPanel
