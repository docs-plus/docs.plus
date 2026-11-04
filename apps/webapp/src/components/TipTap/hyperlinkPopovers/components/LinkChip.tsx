import type { InternalLinkDescriptor } from '../types'

/**
 * The plain chip header: a tile, a label and a sublabel. `InternalLinkChip` uses it for every
 * chip but a filter. Display-only, like that chip.
 */
export function LinkChip({ descriptor }: { descriptor: InternalLinkDescriptor }) {
  const { label, sublabel, icon: Icon } = descriptor
  return (
    <div className="flex items-center gap-3">
      <span className="bg-base-200 text-base-content/70 rounded-field inline-flex size-10 shrink-0 items-center justify-center">
        <Icon size={20} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-base-content truncate text-base font-semibold">{label}</span>
        <span className="text-base-content/60 text-meta truncate">{sublabel}</span>
      </div>
    </div>
  )
}
