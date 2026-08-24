import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

import SheetHeader from './SheetHeader'

export const sheetHeaderClassName = 'border-base-300 shrink-0 border-b px-4 pt-1 pb-3'

type SheetLayoutProps = {
  title: string
  children: ReactNode
  footer?: ReactNode
  headerActions?: ReactNode
  onClose?: () => void
  fillHeight?: boolean
  className?: string
  bodyClassName?: string
}

export function SheetLayout({
  title,
  children,
  footer,
  headerActions,
  onClose,
  fillHeight = false,
  className,
  bodyClassName
}: SheetLayoutProps) {
  return (
    <div
      className={twMerge(
        'bg-base-100 flex flex-col',
        fillHeight ? 'h-full min-h-0' : 'max-h-[min(85dvh,100%)]',
        className
      )}>
      <SheetHeader className={sheetHeaderClassName} onClose={onClose}>
        <SheetHeader.Title>{title}</SheetHeader.Title>
        {headerActions ? <SheetHeader.Actions>{headerActions}</SheetHeader.Actions> : null}
      </SheetHeader>
      <div
        className={twMerge(
          'flex min-h-0 flex-1 flex-col overflow-y-auto',
          // SheetFooter already insets for the safe area — only add it here when there's no footer.
          !footer && 'pb-[max(1rem,env(safe-area-inset-bottom))]',
          bodyClassName
        )}>
        {children}
      </div>
      {footer}
    </div>
  )
}
