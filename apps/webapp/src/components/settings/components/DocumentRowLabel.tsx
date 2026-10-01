import { twMerge } from '@utils/twMerge'
import { LuEye, LuLock, LuStar } from 'react-icons/lu'

import type { OwnedDocument } from '../types'

interface DocumentRowLabelProps {
  doc: Pick<OwnedDocument, 'title' | 'slug' | 'isFavorite' | 'isPrivate' | 'readOnly'>
  className?: string
}

/**
 * Title and badges shared by the Settings list row and the Home Documents row.
 * An empty title falls back to the slug so no row shows a blank label.
 */
function DocumentRowLabel({ doc, className }: DocumentRowLabelProps) {
  return (
    <span className={twMerge('flex min-w-0 items-center gap-1.5', className)}>
      <span className="text-base-content truncate font-medium">{doc.title || doc.slug}</span>
      {doc.isFavorite && (
        <LuStar size={13} className="text-accent fill-accent shrink-0" aria-label="Favorite" />
      )}
      {doc.isPrivate && (
        <LuLock size={13} className="text-base-content/60 shrink-0" aria-label="Private" />
      )}
      {doc.readOnly && (
        <LuEye size={13} className="text-base-content/60 shrink-0" aria-label="Read-only" />
      )}
    </span>
  )
}

export default DocumentRowLabel
