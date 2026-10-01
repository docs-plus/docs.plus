import Button from '@components/ui/Button'
import { LuFileText, LuRotateCcw, LuTrash2 } from 'react-icons/lu'

import type { OwnedDocument } from '../types'
import { formatDeletedAgo, retentionCountdown } from '../utils/retention'

interface TrashListRowProps {
  doc: OwnedDocument
  selected: boolean
  /** Any row selected — hides per-row quick actions in favour of the bulk bar. */
  selectionActive: boolean
  onToggleSelect: (doc: OwnedDocument) => void
  onRestore: (doc: OwnedDocument) => void
  onDeleteForever: (doc: OwnedDocument) => void
}

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
  // /60 is 4.49:1 on the selected primary/10 wash, so a selected row reads at /70.
  const metaInk = selected ? 'text-base-content/70' : 'text-base-content/60'

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
      <LuFileText size={18} aria-hidden className="text-base-content/60 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base-content truncate text-sm font-medium">{label}</span>
        <span className="text-meta">
          <span className={metaInk}>{deletedAgo}</span>
          {countdown && (
            <>
              <span className="text-base-content/40"> · </span>
              <span className={countdown.warn ? 'font-medium text-[var(--warning-ink)]' : metaInk}>
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
          <Button
            size="sm"
            variant="ghost"
            shape="square"
            startIcon={LuTrash2}
            aria-label={`Delete “${label}” forever`}
            className="text-error hover:bg-error/10"
            onClick={() => onDeleteForever(doc)}
          />
        </div>
      )}
    </li>
  )
}

export default TrashListRow
