import { FILTER_MODE_LABEL_CLASS } from '../filterTermPill'
import { describeInternalDocumentLink } from '../internalDocumentLink'
import type { InternalLinkChipProps } from '../types'
import { FilterTermPills } from './FilterTermPills'

/**
 * Named destination header for the mobile preview sheet and composer link
 * dialog: icon tile + primary label + sub-label. A filter also shows its mode
 * label and every term. Display-only — the "Go"
 * action lives in the surrounding sheet/dialog so each surface keeps its own
 * dismiss + keyboard cadence.
 */
export function InternalLinkChip({ link, editor, hideFilterSublabel }: InternalLinkChipProps) {
  const { label, sublabel, icon: Icon, modeLabel } = describeInternalDocumentLink(link, editor)

  if (link.kind === 'filter') {
    // Pills line up under the title: `size-10` tile + `gap-3` = `pl-13`.
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span className="bg-base-200 text-base-content/70 rounded-field inline-flex size-10 shrink-0 items-center justify-center">
            <Icon size={20} aria-hidden />
          </span>
          <span className="text-base-content min-w-0 truncate text-base font-semibold">
            {label}
          </span>
          {modeLabel && <span className={`${FILTER_MODE_LABEL_CLASS} shrink-0`}>{modeLabel}</span>}
        </div>
        <div className="flex flex-col gap-1.5 pl-13">
          <FilterTermPills terms={link.terms} />
          {!hideFilterSublabel && (
            <span className="text-base-content/60 text-meta">{sublabel}</span>
          )}
        </div>
      </div>
    )
  }

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
