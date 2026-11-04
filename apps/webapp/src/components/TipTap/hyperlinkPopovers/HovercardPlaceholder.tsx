import type { ReactNode } from 'react'

import { Band } from './HovercardParts'

const Bone = ({ className }: { className: string }) => (
  <div className="flex h-5 items-center">
    <div className={`skeleton ${className}`} />
  </div>
)

/** A card body while its data loads. `children` follow the bones. */
export function HovercardPlaceholder({ children }: { children?: ReactNode }) {
  return (
    <Band busy>
      <Bone className="h-3.5 w-[72%]" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-[58%]" />
      {children}
    </Band>
  )
}
