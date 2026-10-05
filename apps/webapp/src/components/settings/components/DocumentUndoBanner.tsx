import Button from '@components/ui/Button'
import { twMerge } from '@utils/twMerge'

interface DocumentUndoBannerProps {
  title: string
  onUndo: () => void
  className?: string
}

/** The inline Undo after a soft-delete. Never a toast: a toast portals outside the
 *  Settings modal, whose outside-press dismiss eats the click. */
function DocumentUndoBanner({ title, onUndo, className }: DocumentUndoBannerProps) {
  return (
    <div
      role="status"
      className={twMerge(
        'bg-base-200 rounded-field flex items-center justify-between gap-3 px-3 py-2 motion-safe:animate-[doc-content-in_180ms_ease-out_both]',
        className
      )}>
      <span className="text-base-content/70 truncate text-sm">Deleted “{title}”</span>
      <Button variant="quiet" className="shrink-0" onClick={onUndo}>
        Undo
      </Button>
    </div>
  )
}

export default DocumentUndoBanner
