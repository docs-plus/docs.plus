import { BookmarkPanel } from '@components/bookmarkPanel'
import React from 'react'
import { twMerge } from 'tailwind-merge'

const BookmarkModal = ({ className = '' }: { className?: string }) => {
  return (
    <div className={twMerge('gearModal', className)}>
      <BookmarkPanel />
    </div>
  )
}

export default BookmarkModal
