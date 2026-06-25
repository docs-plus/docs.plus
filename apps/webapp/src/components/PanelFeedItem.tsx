import { MOTION_OVERLAY_OUT_MS } from '@utils/motion'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type PanelFeedItemProps = {
  children: ReactNode
  exiting?: boolean
  className?: string
}

export function PanelFeedItem({ children, exiting = false, className }: PanelFeedItemProps) {
  return (
    <div
      className={twMerge(
        'rounded-box border-base-300 bg-base-100 hover:bg-base-200 flex w-full origin-top items-start gap-3 border p-3 transition-colors motion-safe:transition-[opacity,transform] motion-safe:ease-in',
        exiting &&
          'pointer-events-none opacity-0 motion-safe:-translate-y-1 motion-safe:scale-[0.98]',
        className
      )}
      style={exiting ? { transitionDuration: `${MOTION_OVERLAY_OUT_MS}ms` } : undefined}>
      {children}
    </div>
  )
}
