import { useEffect, useState } from 'react'
import {
  LuCalendar,
  LuEye,
  LuFileText,
  LuHistory,
  LuTrash2,
  LuTriangleAlert,
  LuUser
} from 'react-icons/lu'

import { fetchDocumentPreview } from '@/services/api'
import type { StaleDocumentPreview } from '@/types'
import { formatDate, formatRelative } from '@/utils/format'

interface StalePreviewModalProps {
  isOpen: boolean
  slug: string | null
  onConfirmDelete: (slug: string) => void
  onCancel: () => void
  isDeleting: boolean
}

/**
 * Preview modal for stale documents - shows content preview and deletion impact
 */
export function StalePreviewModal({
  isOpen,
  slug,
  onConfirmDelete,
  onCancel,
  isDeleting
}: StalePreviewModalProps) {
  const [preview, setPreview] = useState<StaleDocumentPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')

  useEffect(() => {
    if (isOpen && slug) {
      setConfirmInput('')
      setPreview(null)
      setLoading(true)
      fetchDocumentPreview(slug)
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setLoading(false))
    }
  }, [isOpen, slug])

  if (!isOpen || !slug) return null

  const canDelete = confirmInput === slug && !loading
  const ownerDisplay = preview?.owner?.username || preview?.owner?.email?.split('@')[0] || null
  const hasWorkspace = !!preview?.deletion_impact.workspace_id

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        {/* Header */}
        <div className="border-base-300 flex items-start gap-4 border-b pb-4">
          <div className="bg-warning/10 rounded-xl p-3">
            <LuEye className="text-warning h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">Document Preview</h3>
            <code className="text-base-content/60 text-sm">{slug}</code>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="text-base-content/60 text-sm">Loading preview...</p>
          </div>
        ) : preview ? (
          <div className="space-y-5 py-5">
            {/* Document Info */}
            <div className="card bg-base-200 border-base-300 border">
              <div className="card-body gap-3 p-4">
                <h4 className="line-clamp-1 text-base font-semibold">
                  {preview.title || 'Untitled Document'}
                </h4>

                <div className="border-base-300 grid grid-cols-2 gap-3 border-t pt-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 rounded-lg p-1.5">
                      <LuUser className="text-base-content/60 h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base-content/40 text-[10px] font-medium tracking-wide uppercase">
                        Owner
                      </p>
                      <p className="truncate text-sm font-medium">
                        {ownerDisplay || <span className="text-base-content/40">No owner</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 rounded-lg p-1.5">
                      <LuHistory className="text-base-content/60 h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-base-content/40 text-[10px] font-medium tracking-wide uppercase">
                        Versions
                      </p>
                      <p className="text-sm font-medium">{preview.version_count}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 rounded-lg p-1.5">
                      <LuCalendar className="text-base-content/60 h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-base-content/40 text-[10px] font-medium tracking-wide uppercase">
                        Created
                      </p>
                      <p className="text-sm font-medium">{formatDate(preview.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 rounded-lg p-1.5">
                      <LuFileText className="text-base-content/60 h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-base-content/40 text-[10px] font-medium tracking-wide uppercase">
                        Last Edit
                      </p>
                      <p className="text-sm font-medium">{formatRelative(preview.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Preview */}
            <div>
              <label className="label pb-1">
                <span className="label-text text-sm font-medium">Content Preview</span>
              </label>
              <div className="bg-base-200 border-base-300 max-h-32 overflow-y-auto rounded-lg border p-3">
                <pre className="text-base-content/70 font-mono text-xs whitespace-pre-wrap">
                  {preview.content_preview || '(Empty document)'}
                </pre>
              </div>
            </div>

            {/* Deletion Impact */}
            {hasWorkspace && (
              <div className="alert bg-warning/10 border-warning/20 text-warning-content border">
                <LuTriangleAlert className="text-warning h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Deletion will also remove:</span>
                  <ul className="text-base-content/70 mt-1 list-inside list-disc">
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

            {/* Confirmation Input */}
            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text text-sm">
                  Type <kbd className="kbd kbd-sm font-mono">{slug}</kbd> to confirm deletion
                </span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full font-mono ${
                  confirmInput && confirmInput !== slug ? 'input-error' : ''
                } ${confirmInput === slug ? 'input-success' : ''}`}
                placeholder={slug}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canDelete && onConfirmDelete(slug)}
                disabled={isDeleting}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-base-content/60">Failed to load document preview</p>
          </div>
        )}

        {/* Actions */}
        <div className="border-base-300 flex gap-3 border-t pt-4">
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={onCancel}
            disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error flex-1"
            onClick={() => canDelete && onConfirmDelete(slug)}
            disabled={!canDelete || isDeleting}>
            {isDeleting ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Deleting...
              </>
            ) : (
              <>
                <LuTrash2 className="h-4 w-4" />
                Delete Document
              </>
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/60" onClick={isDeleting ? undefined : onCancel} />
    </dialog>
  )
}
