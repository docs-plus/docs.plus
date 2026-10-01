import { openConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'

import { formatVersionDate } from '../helpers'

type RestoreConfirmArgs = {
  createdAt: string | undefined
  /** Versions saved after this one, or null when the active version is not in the list. */
  newerCount: number | null
  onConfirm: () => void
  onDismiss?: () => void
}

export function openHistoryRestoreConfirm({
  createdAt,
  newerCount,
  onConfirm,
  onDismiss
}: RestoreConfirmArgs): void {
  // A date and time is what the sidebar shows. The version number appears nowhere
  // a reader can see, so naming one here would point at nothing.
  const stamp = createdAt ? formatVersionDate(createdAt) : null
  const title = stamp
    ? `Restore the version from ${stamp.date}, ${stamp.time}?`
    : 'Restore this version?'

  openConfirmDialog({
    title,
    body: 'This replaces the document for everyone working in it, right now. The document you have now is saved first, so you can go back to it.',
    children:
      newerCount !== null && newerCount > 0 ? (
        <p className="text-base-content/70 text-sm">
          {newerCount === 1
            ? '1 version was saved after this one.'
            : `${newerCount} versions were saved after this one.`}
        </p>
      ) : undefined,
    confirmLabel: 'Restore version',
    onConfirm,
    onDismiss
  })
}
