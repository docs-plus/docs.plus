import { useEffect, useState } from 'react'
import { LuCalendar, LuFileText, LuHistory, LuTriangleAlert, LuUser } from 'react-icons/lu'

import { fetchDocumentPreview } from '@/services/api'
import type { StaleDocumentPreview } from '@/types'
import { formatDate, formatRelative, userLabel } from '@/utils/format'

import { DeleteDocumentDialog } from './DeleteDocumentDialog'
import { DocumentFact } from './DocumentFact'
import { TypeToConfirm } from './TypeToConfirm'

interface StalePreviewModalProps {
  slug: string
  onConfirmDelete: (slug: string) => void
  onCancel: () => void
  isDeleting: boolean
}

/** Mount with `key={slug}`, so a new target starts fresh. */
export function StalePreviewModal({
  slug,
  onConfirmDelete,
  onCancel,
  isDeleting
}: StalePreviewModalProps) {
  const [preview, setPreview] = useState<StaleDocumentPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmInput, setConfirmInput] = useState('')

  useEffect(() => {
    fetchDocumentPreview(slug)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoading(false))
  }, [slug])

  const canDelete = confirmInput === slug && !loading
  const ownerDisplay = userLabel(preview?.owner?.username, preview?.owner?.email)
  const hasWorkspace = !!preview?.deletion_impact.workspace_id

  const handleConfirm = () => {
    if (canDelete) onConfirmDelete(slug)
  }

  return (
    <DeleteDocumentDialog
      title="Document preview"
      subtitle={<code className="text-base-content/60 text-sm break-all">{slug}</code>}
      width="lg"
      isDeleting={isDeleting}
      canDelete={canDelete}
      onConfirm={handleConfirm}
      onCancel={onCancel}>
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <span className="loading loading-spinner loading-md text-primary" />
          <p className="text-base-content/60 text-sm">Loading preview...</p>
        </div>
      ) : preview ? (
        <>
          <div className="card bg-base-200 border-base-300 border">
            <div className="card-body gap-3 p-4">
              <h4 className="line-clamp-1 text-base font-semibold">
                {preview.title || 'Untitled Document'}
              </h4>

              <div className="border-base-300 grid grid-cols-2 gap-3 border-t pt-3">
                <DocumentFact icon={LuUser} label="Owner">
                  {ownerDisplay || <span className="text-base-content/70">No owner</span>}
                </DocumentFact>
                <DocumentFact icon={LuHistory} label="Versions">
                  {preview.version_count}
                </DocumentFact>
                <DocumentFact icon={LuCalendar} label="Created">
                  {formatDate(preview.created_at)}
                </DocumentFact>
                <DocumentFact icon={LuFileText} label="Last edit">
                  {formatRelative(preview.updated_at)}
                </DocumentFact>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-meta font-semibold">Content preview</p>
            <div className="bg-base-200 border-base-300 rounded-box max-h-32 overflow-y-auto border p-3">
              <p className="text-base-content/70 text-meta whitespace-pre-wrap">
                {preview.content_preview || '(Empty document)'}
              </p>
            </div>
          </div>

          {hasWorkspace && (
            <div className="alert alert-soft alert-warning items-start">
              <LuTriangleAlert
                className="mt-0.5 size-4 shrink-0 text-[var(--warning-ink)]"
                aria-hidden
              />
              <div className="text-base-content text-sm">
                <span className="font-medium">Deletion will also remove:</span>
                <ul className="text-base-content/70 mt-1 list-outside list-disc pl-4">
                  <li>
                    {preview.deletion_impact.channel_count} channel
                    {preview.deletion_impact.channel_count !== 1 ? 's' : ''}
                  </li>
                  <li>
                    {preview.deletion_impact.message_count} message
                    {preview.deletion_impact.message_count !== 1 ? 's' : ''}
                  </li>
                  <li>All workspace members and notifications</li>
                </ul>
              </div>
            </div>
          )}

          <TypeToConfirm
            expected={slug}
            value={confirmInput}
            onChange={setConfirmInput}
            onSubmit={handleConfirm}
            disabled={isDeleting}
          />
        </>
      ) : (
        <p className="text-base-content/70 text-sm">Failed to load document preview.</p>
      )}
    </DeleteDocumentDialog>
  )
}
