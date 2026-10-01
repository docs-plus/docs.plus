import { sheetSafeAreaPadClassName } from '@utils/sheetBodyPadding'
import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'

type SheetFooterProps = {
  children: ReactNode
  className?: string
}

export function SheetFooter({ children, className }: SheetFooterProps) {
  return (
    <footer
      className={twMerge(
        'border-base-300 bg-base-100 shrink-0 border-t px-4 pt-3',
        sheetSafeAreaPadClassName,
        className
      )}>
      {children}
    </footer>
  )
}
