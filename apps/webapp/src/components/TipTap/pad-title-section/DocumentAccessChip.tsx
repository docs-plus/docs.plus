import { Icons } from '@icons'
import { useStore } from '@stores'
import type { ComponentType } from 'react'
import { twMerge } from 'tailwind-merge'

const chipClassName =
  'rounded-field p-2 ml-4 hover:border-primary transition-[border-color] flex align-middle items-center justify-center border text-base-content/50 motion-safe:animate-[doc-region-in_180ms_ease-out_both]'

type ChipIcon = ComponentType<{ size?: number; className?: string }>

/** Store-driven pad title chip for Private / Read-only (no WS listeners). */
export function DocumentAccessChip({
  visible,
  label,
  Icon,
  className
}: {
  visible: boolean
  label: string
  Icon: ChipIcon
  className?: string
}) {
  if (!visible) return null
  return (
    <div className={twMerge(chipClassName, className)}>
      <Icon size={13} className="text-base-content/40" />
      <p className="ml-3 hidden text-xs font-bold antialiased sm:flex">{label}</p>
    </div>
  )
}

export function PrivateIndicator({ className }: { className?: string }) {
  const isPrivate = useStore((state) => Boolean(state.settings.metadata?.isPrivate))
  return (
    <DocumentAccessChip
      visible={isPrivate}
      label="Private"
      Icon={Icons.lock}
      className={className}
    />
  )
}

export function ReadOnlyIndicator({ className }: { className?: string }) {
  const isReadOnly = useStore((state) => Boolean(state.settings.metadata?.readOnly))
  return (
    <DocumentAccessChip
      visible={isReadOnly}
      label="Read-only"
      Icon={Icons.penOff}
      className={className}
    />
  )
}
