import CloseButton from '@components/ui/CloseButton'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type SheetHeaderProps = {
  onClose?: () => void
  className?: string
  children?: ReactNode
}

function SheetHeaderTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={twMerge('text-base-content flex-1 text-lg font-semibold', className)}>
      {children}
    </p>
  )
}

function SheetHeaderActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={twMerge('flex flex-row items-center justify-end gap-1', className)}>
      {children}
    </div>
  )
}

function SheetHeader({ onClose, className, children }: SheetHeaderProps) {
  return (
    <div className={twMerge('flex w-full items-center justify-between gap-2', className)}>
      {children}
      {onClose !== undefined && <CloseButton onClick={onClose} size="sm" className="shrink-0" />}
    </div>
  )
}

SheetHeader.Title = SheetHeaderTitle
SheetHeader.Actions = SheetHeaderActions

export default SheetHeader
