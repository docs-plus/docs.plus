import { FILTER_MODE_LABEL_CLASS } from '../filterTermPill'
import type { InternalLinkChipProps } from '../types'
import { FilterTermPills } from './FilterTermPills'
import { LinkChip } from './LinkChip'

/**
 * Named destination header for the mobile preview sheet and composer link dialog: `/new` or
 * a place in this pad. A filter also shows its mode label and every term. Display-only: the
 * action lives in the surrounding sheet or dialog, so each surface keeps its own dismiss and keys.
 */
export function InternalLinkChip({
  destination,
  descriptor,
  hideFilterSublabel
}: InternalLinkChipProps) {
  const { label, sublabel, icon: Icon, modeLabel } = descriptor

  if (destination.kind === 'here' && destination.link.kind === 'filter') {
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
          <FilterTermPills terms={destination.link.terms} />
          {!hideFilterSublabel && (
            <span className="text-base-content/60 text-meta">{sublabel}</span>
          )}
        </div>
      </div>
    )
  }

  return <LinkChip descriptor={descriptor} />
}
