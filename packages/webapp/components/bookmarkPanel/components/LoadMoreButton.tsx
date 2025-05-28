import { IoChevronDownOutline } from 'react-icons/io5'
import { useLoadMoreBookmarks } from '../hooks/useLoadMoreBookmarks'
import { useChatStore } from '@stores'
import Button from '@components/ui/Button'

export const LoadMoreButton = () => {
  const { loadingBookmarks } = useChatStore((state) => state)
  const { loadMore, lastPage } = useLoadMoreBookmarks()

  // I didn't have a workaround for this; I had to implement it this way to keep the modal from closing.
  const buttonContent = loadingBookmarks ? (
    <div className="loading loading-spinner loading-md" />
  ) : !lastPage ? (
    <>
      Load More
      <IoChevronDownOutline className="h-4 w-4" />
    </>
  ) : (
    'No more bookmarks'
  )

  return (
    <Button
      onClick={loadMore}
      type="button"
      className="btn btn-ghost btn-sm btn-block inline-flex items-center gap-2">
      {buttonContent}
    </Button>
  )
}
