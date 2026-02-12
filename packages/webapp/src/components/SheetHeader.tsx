import CloseButton from '@components/ui/CloseButton'
import { useSheetStore } from '@stores'
import React from 'react'
import { twMerge } from 'tailwind-merge'

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

const SheetHeaderTitle: React.FC<SheetHeaderTitleProps> = ({ children, className }) => (
  <p className={twMerge('text-base-content flex-1 text-lg font-semibold', className)}>{children}</p>
)

const SheetHeaderActions: React.FC<SheetHeaderActionsProps> = ({ children, className }) => (
  <div className={twMerge('flex flex-row items-center justify-end', className)}>{children}</div>
)

const SheetHeader: React.FC<SheetHeaderProps> & {
  Title: typeof SheetHeaderTitle
  Actions: typeof SheetHeaderActions
} = ({ title, onClose, className, children }) => {
  const { closeSheet } = useSheetStore()
  const handleClose = onClose || closeSheet

  // Compound component usage
  if (children) {
    return (
      <div
        className={twMerge(
          'bg-base-100 mb-4 flex w-full items-center justify-between py-2',
          className
        )}>
        {children}
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'bg-base-100 mb-4 flex w-full items-center justify-between py-2',
        className
      )}>
      <p className="text-base-content flex-1 text-lg font-bold">{title}</p>
      <div className="flex flex-row items-center justify-end">
        <CloseButton onClick={handleClose} />
      </div>
    </div>
  )
}

SheetHeader.Title = SheetHeaderTitle
SheetHeader.Actions = SheetHeaderActions

export default SheetHeader
