import { Icons } from '@icons'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import type { ComponentType } from 'react'

const chipClassName =
  'rounded-field border-base-300 p-2 ml-4 flex align-middle items-center justify-center border text-base-content/70 motion-safe:animate-[doc-region-in_180ms_ease-out_both]'

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
      <span aria-hidden className="flex">
        <Icon size={13} />
      </span>
      {/* Phones hide the label visually but still announce the access state. */}
      <span className="sr-only text-xs font-bold antialiased sm:not-sr-only sm:ml-3">{label}</span>
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
