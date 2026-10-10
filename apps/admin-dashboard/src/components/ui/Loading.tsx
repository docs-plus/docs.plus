import type { CSSProperties } from 'react'
import { twMerge } from 'tailwind-merge'

/** The block loader. The auth chunk loader and AuthGuard share it, so their handoff moves no pixel. */
export function Loading({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      role="status"
      className={twMerge('flex items-center justify-center', className)}
      style={style}>
      <span className="loading loading-spinner loading-lg" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  )
}
