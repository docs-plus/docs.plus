import CloseButton from '@components/ui/CloseButton'
import { usePopoverState } from '@components/ui/Popover'

interface BookmarkHeaderProps {
  onClose?: () => void
  showClose?: boolean
}

/**
 * Simplified bookmark header.
 * Clean, minimal design with title and close button.
 */
export const BookmarkHeader = ({ onClose, showClose = true }: BookmarkHeaderProps) => {
  const popoverState = usePopoverState()
  const handleClose = onClose || popoverState.close

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base-content text-lg font-semibold">Bookmarks</h2>

      <div className="flex items-center gap-1">
        {showClose && <CloseButton onClick={handleClose} size="sm" />}
      </div>
    </div>
  )
}
