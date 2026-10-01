import { clsx } from 'clsx'
import { ReactNode } from 'react'

interface SectionCardProps {
  children: ReactNode
  className?: string
}

/** The L0 in-page card frame; `StatCard` keeps its own frame for the metric layout. */
export function SectionCard({ children, className }: SectionCardProps) {
  return (
    <div className={clsx('bg-base-100 rounded-box border-base-300 border', className)}>
      {children}
    </div>
  )
}
