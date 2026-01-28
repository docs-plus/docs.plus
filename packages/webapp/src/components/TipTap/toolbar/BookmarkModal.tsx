import { BookmarkPanel } from '@components/bookmarkPanel'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface BookmarkModalProps {
  className?: string
  onClose?: () => void
}

const BookmarkModal = ({ className = '', onClose }: BookmarkModalProps) => {
  return (
    <div className={twMerge('bg-base-100 flex w-full flex-col', className)}>
      <BookmarkPanel onClose={onClose} />
    </div>
  )
}

export default BookmarkModal
