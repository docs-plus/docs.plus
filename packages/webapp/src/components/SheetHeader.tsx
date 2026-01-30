import CloseButton from '@components/ui/CloseButton'
import { useSheetStore } from '@stores'
import React from 'react'

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
  <p className={`flex-1 text-lg font-semibold text-slate-800 ${className}`}>{children}</p>
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
      <div className={`mb-4 flex w-full items-center justify-between bg-white py-2 ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <div className={`mb-4 flex w-full items-center justify-between bg-white py-2 ${className}`}>
      <p className="flex-1 text-lg font-bold text-slate-800">{title}</p>
      <div className="flex flex-row items-center justify-end">
        <CloseButton onClick={handleClose} />
      </div>
    </div>
  )
}

SheetHeader.Title = SheetHeaderTitle
SheetHeader.Actions = SheetHeaderActions

export default SheetHeader
