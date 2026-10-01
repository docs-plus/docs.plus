import { PanelPopoverHeader } from '@components/PanelPopoverHeader'
import { type SheetBodyLayout, SheetLayout } from '@components/SheetLayout'
import { useDismissPanel } from '@hooks/useDismissPanel'
import type { PanelSurfaceVariant } from '@types'
import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'

type PanelSurfaceShellProps = {
  variant: PanelSurfaceVariant
  title: string
  children: ReactNode
  fillHeight?: boolean
  headerActions?: ReactNode
  footer?: ReactNode
  /** Sheet only: passed to `SheetLayout`. */
  body?: SheetBodyLayout
  bodyClassName?: string
  /** Popover only: merged onto the outer frame. */
  className?: string
}

/** Popover panel vs mobile sheet: one title header and close, divergent frame only. */
export function PanelSurfaceShell({
  variant,
  title,
  children,
  fillHeight = false,
  headerActions,
  footer,
  body,
  bodyClassName,
  className
}: PanelSurfaceShellProps) {
  const dismiss = useDismissPanel(variant)

  if (variant === 'sheet') {
    return (
      <SheetLayout
        title={title}
        fillHeight={fillHeight}
        headerActions={headerActions}
        footer={footer}
        onClose={dismiss}
        body={body}
        bodyClassName={bodyClassName}>
        {children}
      </SheetLayout>
    )
  }

  return (
    <div className={twMerge('bg-base-100 flex min-h-0 w-full flex-col overflow-hidden', className)}>
      <div className="border-base-300 shrink-0 border-b px-4 py-3">
        <PanelPopoverHeader title={title} actions={headerActions} onClose={dismiss} />
      </div>
      {children}
      {footer ? <div className="border-base-300 shrink-0 border-t">{footer}</div> : null}
    </div>
  )
}
