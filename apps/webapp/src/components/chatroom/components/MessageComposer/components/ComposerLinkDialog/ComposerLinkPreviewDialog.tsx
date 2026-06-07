import { copyToClipboard } from '@utils/clipboard'
import { useId } from 'react'

import { ComposerLinkModalShell } from './ComposerLinkModalShell'

type Props = {
  href: string
  onEdit: () => void
  onRemove: () => void
  onClose: () => void
}

export function ComposerLinkPreviewDialog({ href, onEdit, onRemove, onClose }: Props) {
  const titleId = useId()

  const handleCopy = async () => {
    const ok = await copyToClipboard(href)
    if (!ok) console.error('Failed to copy link to clipboard')
  }

  return (
    <ComposerLinkModalShell titleId={titleId} onBackdropClick={onClose}>
      <div data-testid="composer-link-preview">
        <h2 id={titleId} className="sr-only">
          Link options
        </h2>
        <p className="truncate text-sm" title={href}>
          {href}
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <button
            type="button"
            className="btn btn-ghost justify-start"
            onClick={() => void handleCopy()}
            data-testid="composer-link-preview-copy">
            Copy link
          </button>
          <button
            type="button"
            className="btn btn-ghost text-error justify-start"
            onClick={onRemove}
            data-testid="composer-link-preview-remove">
            Remove link
          </button>
          <button
            type="button"
            className="btn btn-ghost justify-start"
            onClick={onEdit}
            data-testid="composer-link-preview-edit">
            Edit
          </button>
        </div>
      </div>
    </ComposerLinkModalShell>
  )
}
