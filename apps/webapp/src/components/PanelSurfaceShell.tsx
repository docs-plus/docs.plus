import { SheetLayout } from '@components/SheetLayout'
import type { PanelSurfaceVariant } from '@types'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type PanelSurfaceShellProps = {
  variant: PanelSurfaceVariant
  title: string
  children: ReactNode
  popoverHeader: ReactNode
  fillHeight?: boolean
  headerActions?: ReactNode
  footer?: ReactNode
  /** Popover only: set false to drop the bordered header bar (header supplies its own padding). */
  popoverHeaderBordered?: boolean
  onClose?: () => void
  bodyClassName?: string
  className?: string
}

/** Popover panel vs mobile sheet: shared title header, divergent chrome only. */
export function PanelSurfaceShell({
  variant,
  title,
  children,
  popoverHeader,
  fillHeight = false,
  headerActions,
  footer,
  popoverHeaderBordered = true,
  onClose,
  bodyClassName,
  className
}: PanelSurfaceShellProps) {
  if (variant === 'sheet') {
    return (
      <SheetLayout
        title={title}
        fillHeight={fillHeight}
        headerActions={headerActions}
        footer={footer}
        onClose={onClose}
        bodyClassName={bodyClassName}>
        {children}
      </SheetLayout>
    )
  }

  return (
    <div className={twMerge('bg-base-100 flex min-h-0 w-full flex-col overflow-hidden', className)}>
      <div
        className={
          popoverHeaderBordered ? 'border-base-300 shrink-0 border-b px-4 py-3' : 'shrink-0'
        }>
        {popoverHeader}
      </div>
      {children}
      {footer ? <div className="border-base-300 shrink-0 border-t">{footer}</div> : null}
    </div>
  )
}
