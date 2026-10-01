import CloseButton from '@components/ui/CloseButton'
import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'

type SheetHeaderProps = {
  onClose?: () => void
  className?: string
  children?: ReactNode
}

/** An `h2`, like the popover twin `PanelPopoverHeader`, so the sheet keeps its heading. */
function SheetHeaderTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={twMerge(
        'text-base-content min-w-0 flex-1 text-xl font-semibold break-words',
        className
      )}>
      {children}
    </h2>
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
      {onClose !== undefined && (
        <CloseButton
          onClick={onClose}
          size="sm"
          iconSize={20}
          className="min-h-11 min-w-11 shrink-0"
        />
      )}
    </div>
  )
}

SheetHeader.Title = SheetHeaderTitle
SheetHeader.Actions = SheetHeaderActions

export default SheetHeader
