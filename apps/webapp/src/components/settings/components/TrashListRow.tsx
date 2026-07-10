import Button from '@components/ui/Button'
import { LuFileText, LuRotateCcw, LuTrash2 } from 'react-icons/lu'

import type { OwnedDocument } from '../types'
import { formatDeletedAgo, retentionCountdown } from '../utils/retention'

// Warning ink for the small "N days left" tail: raw --color-warning is only
// ~3.1:1 on the Paper ground (sub-AA for small text). Mix toward base-content to
// clear AA as a **direct** color — an @theme <color> token would freeze the mix
// against :root; a direct color re-resolves per theme (darker on light grounds,
// lighter on dark), so it stays legible everywhere.
const WARN_INK_CLASS =
  'text-[color:color-mix(in_oklch,var(--color-warning),var(--color-base-content)_30%)]'

interface TrashListRowProps {
  doc: OwnedDocument
  selected: boolean
  /** Any row selected — hides per-row quick actions in favour of the bulk bar. */
  selectionActive: boolean
  onToggleSelect: (doc: OwnedDocument) => void
  onRestore: (doc: OwnedDocument) => void
  onDeleteForever: (doc: OwnedDocument) => void
}

/**
 * One soft-deleted document in Trash: a select checkbox, a "deleted X ago ·
 * N days left" countdown (amber in the final days), and — when nothing is
 * selected — inline Restore / Delete-forever quick actions.
 */
function TrashListRow({
  doc,
  selected,
  selectionActive,
  onToggleSelect,
  onRestore,
  onDeleteForever
}: TrashListRowProps) {
  const label = doc.title ?? doc.slug
  const deletedAtIso = doc.deletedAt ?? doc.updatedAt
  const deletedAgo = formatDeletedAgo(deletedAtIso)
  const countdown = retentionCountdown(deletedAtIso)

  return (
    <li
      className={`rounded-field flex items-center gap-3 px-2 py-3 transition-colors ${
        selected ? 'bg-primary/10' : 'hover:bg-base-200'
      }`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(doc)}
        aria-label={`Select “${label}”`}
        className="checkbox checkbox-sm checkbox-primary shrink-0"
      />
      <LuFileText size={18} className="text-base-content/40 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base-content truncate font-medium">{label}</span>
        <span className="text-xs">
          <span className="text-base-content/50">{deletedAgo}</span>
          {countdown && (
            <>
              <span className="text-base-content/30"> · </span>
              <span
                className={
                  countdown.warn ? `${WARN_INK_CLASS} font-medium` : 'text-base-content/50'
                }>
                {countdown.text}
              </span>
            </>
          )}
        </span>
      </span>

      {!selectionActive && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            startIcon={LuRotateCcw}
            data-trash-action
            className="text-base-content/70 hover:text-base-content"
            onClick={() => onRestore(doc)}>
            Restore
          </Button>
          <button
            type="button"
            aria-label={`Delete “${label}” forever`}
            onClick={() => onDeleteForever(doc)}
            className="text-error/70 hover:bg-error/10 hover:text-error rounded-field inline-flex min-h-9 min-w-9 items-center justify-center transition-colors">
            <LuTrash2 size={18} />
          </button>
        </div>
      )}
    </li>
  )
}

export default TrashListRow
