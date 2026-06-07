import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type SheetFooterProps = {
  children: ReactNode
  className?: string
}

/** Shared sticky bottom shell for mobile sheet action rows. */
export function SheetFooter({ children, className }: SheetFooterProps) {
  return (
    <footer
      className={twMerge(
        'border-base-300 bg-base-100 shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]',
        className
      )}>
      {children}
    </footer>
  )
}
