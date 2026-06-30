import { describeInternalDocumentLink } from '../internalDocumentLink'
import type { InternalLinkChipProps } from '../types'

/**
 * Named destination header for the mobile preview sheet and composer link
 * dialog: icon tile + primary label + sub-label. Display-only — the "Go"
 * action lives in the surrounding sheet/dialog so each surface keeps its own
 * dismiss + keyboard cadence.
 */
export function InternalLinkChip({ link, editor }: InternalLinkChipProps) {
  const { label, sublabel, icon: Icon } = describeInternalDocumentLink(link, editor)

  return (
    <div className="flex items-center gap-3">
      <span className="bg-primary/10 text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Icon size={20} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-base-content truncate text-base font-semibold">{label}</span>
        <span className="text-base-content/60 truncate text-xs">{sublabel}</span>
      </div>
    </div>
  )
}
