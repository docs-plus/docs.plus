import React from 'react'
import { IoClose } from 'react-icons/io5'
import { useSheetStore } from '@stores'

interface SheetHeaderProps {
  title?: string
  onClose?: () => void
  className?: string
  children?: React.ReactNode
}

interface SheetHeaderTitleProps {
  children: React.ReactNode
  className?: string
}

interface SheetHeaderActionsProps {
  children: React.ReactNode
  className?: string
}

const SheetHeaderTitle: React.FC<SheetHeaderTitleProps> = ({ children, className = '' }) => (
  <p className={`flex-1 text-lg font-semibold ${className}`}>{children}</p>
)

const SheetHeaderActions: React.FC<SheetHeaderActionsProps> = ({ children, className = '' }) => (
  <div className={`flex flex-row items-center justify-end ${className}`}>{children}</div>
)

const SheetHeader: React.FC<SheetHeaderProps> & {
  Title: typeof SheetHeaderTitle
  Actions: typeof SheetHeaderActions
} = ({ title, onClose, className = '', children }) => {
  const { closeSheet } = useSheetStore()
  const handleClose = onClose || closeSheet

  // Compound component usage
  if (children) {
    return (
      <div className={`mb-3 flex w-full bg-white pb-2 text-black ${className}`}>{children}</div>
    )
  }

  return (
    <div className={`mb-3 flex w-full bg-white pb-2 text-black ${className}`}>
      <p className="flex-1 text-lg font-semibold">{title}</p>
      <div className="flex flex-row items-center justify-end">
        <button className="btn btn-square btn-ghost btn-sm ml-2 text-black" onClick={handleClose}>
          <IoClose size={20} />
        </button>
      </div>
    </div>
  )
}

SheetHeader.Title = SheetHeaderTitle
SheetHeader.Actions = SheetHeaderActions

export default SheetHeader
