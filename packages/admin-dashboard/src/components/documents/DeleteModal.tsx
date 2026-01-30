import { useEffect,useState } from 'react'
import {
  LuCalendar,
  LuHistory,
  LuMessageSquare,
  LuTrash2,
  LuTriangleAlert,
  LuUser} from 'react-icons/lu'

import { type DeletionImpact,getDocumentDeletionImpact } from '@/services/api'
import type { Document } from '@/types'
import { formatDate } from '@/utils/format'

interface DeleteModalProps {
  isOpen: boolean
  doc: Document | null
  onConfirm: (confirmSlug: string) => void
  onCancel: () => void
  isDeleting: boolean
}

/**
 * Delete confirmation modal with document details and impact preview
 * Requires user to type the document slug to confirm deletion
 */
export function DeleteModal({ isOpen, doc, onConfirm, onCancel, isDeleting }: DeleteModalProps) {
  const [confirmInput, setConfirmInput] = useState('')
  const [impact, setImpact] = useState<DeletionImpact | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch impact when modal opens
  useEffect(() => {
    if (isOpen && doc) {
      setConfirmInput('')
      setImpact(null)
      setLoading(true)
      getDocumentDeletionImpact(doc.id)
        .then(setImpact)
        .catch(() => setImpact(null))
        .finally(() => setLoading(false))
    }
  }, [isOpen, doc])

  if (!isOpen || !doc) return null

  const slug = doc.docId
  const canDelete = confirmInput === slug && !loading

  const handleConfirm = () => {
    if (canDelete) onConfirm(confirmInput)
  }

  const ownerDisplay = impact?.owner?.username || impact?.owner?.email?.split('@')[0] || null
  const channelCount = impact?.workspace?.channelCount ?? 0
  const versionCount = impact?.document.versionCount ?? doc.versionCount

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        {/* Header */}
        <div className="border-base-300 flex items-start gap-4 border-b pb-4">
          <div className="bg-error/10 rounded-xl p-3">
            <LuTrash2 className="text-error h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">Delete Document</h3>
            <p className="text-base-content/60 mt-0.5 text-sm">
              This action is permanent and cannot be undone.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="text-base-content/60 text-sm">Loading document details...</p>
          </div>
        ) : (
          <div className="space-y-5 py-5">
            {/* Document Card */}
            <div className="card bg-base-200 border-base-300 border">
              <div className="card-body gap-3 p-4">
                {/* Title & Slug */}
                <div>
                  <h4 className="line-clamp-1 text-base font-semibold">
                    {doc.title || 'Untitled Document'}
                  </h4>
                  <code className="text-base-content/50 bg-base-300 mt-1 inline-block rounded px-1.5 py-0.5 text-xs">
                    {slug}
                  </code>
                </div>

                {/* Meta Grid */}
                <div className="border-base-300 grid grid-cols-2 gap-3 border-t pt-2">
                  {/* Owner */}
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

                  {/* Versions */}
                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 rounded-lg p-1.5">
                      <LuHistory className="text-base-content/60 h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-base-content/40 text-[10px] font-medium tracking-wide uppercase">
                        Versions
                      </p>
                      <p className="text-sm font-medium">{versionCount}</p>
                    </div>
                  </div>

                  {/* Channels */}
                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 rounded-lg p-1.5">
                      <LuMessageSquare className="text-base-content/60 h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-base-content/40 text-[10px] font-medium tracking-wide uppercase">
                        Channels
                      </p>
                      <p className="text-sm font-medium">
                        {impact?.workspace ? (
                          channelCount
                        ) : (
                          <span className="text-base-content/40">None</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Created */}
                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 rounded-lg p-1.5">
                      <LuCalendar className="text-base-content/60 h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-base-content/40 text-[10px] font-medium tracking-wide uppercase">
                        Created
                      </p>
                      <p className="text-sm font-medium">{formatDate(doc.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Alert */}
            {impact?.workspace && (
              <div className="alert bg-warning/10 border-warning/20 text-warning-content border">
                <LuTriangleAlert className="text-warning h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Workspace data will be deleted:</span>
                  <span className="text-base-content/70 ml-1">
                    {channelCount} channel{channelCount !== 1 ? 's' : ''}, all messages, members,
                    and notifications.
                  </span>
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
                onKeyDown={(e) => e.key === 'Enter' && canDelete && handleConfirm()}
                disabled={isDeleting}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </div>
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
            onClick={handleConfirm}
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
