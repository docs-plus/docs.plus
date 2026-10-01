import { useEffect, useState } from 'react'
import { LuCalendar, LuHistory, LuMessageSquare, LuTriangleAlert, LuUser } from 'react-icons/lu'

import { getDocumentDeletionImpact } from '@/services/api'
import type { DeletionImpact, Document } from '@/types'
import { formatDate, userLabel } from '@/utils/format'

import { DeleteDocumentDialog } from './DeleteDocumentDialog'
import { DocumentFact } from './DocumentFact'
import { TypeToConfirm } from './TypeToConfirm'

interface DeleteModalProps {
  doc: Document
  onConfirm: (confirmSlug: string) => void
  onCancel: () => void
  isDeleting: boolean
}

/** Mount with `key={doc.id}`, so a new target starts fresh. */
export function DeleteModal({ doc, onConfirm, onCancel, isDeleting }: DeleteModalProps) {
  const [confirmInput, setConfirmInput] = useState('')
  const [impact, setImpact] = useState<DeletionImpact | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocumentDeletionImpact(doc.id)
      .then(setImpact)
      .catch(() => setImpact(null))
      .finally(() => setLoading(false))
  }, [doc.id])

  const slug = doc.docId
  const canDelete = confirmInput === slug && !loading

  const handleConfirm = () => {
    if (canDelete) onConfirm(confirmInput)
  }

  const ownerDisplay = userLabel(impact?.owner?.username, impact?.owner?.email)
  const channelCount = impact?.workspace?.channelCount ?? 0
  const versionCount = impact?.document.versionCount ?? doc.versionCount

  return (
    <DeleteDocumentDialog
      title="Delete document"
      subtitle={
        <p className="text-base-content/60 text-sm">
          This action is permanent and cannot be undone.
        </p>
      }
      width="md"
      isDeleting={isDeleting}
      canDelete={canDelete}
      onConfirm={handleConfirm}
      onCancel={onCancel}>
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <span className="loading loading-spinner loading-md text-primary" />
          <p className="text-base-content/60 text-sm">Loading document details...</p>
        </div>
      ) : (
        <>
          <div className="card bg-base-200 border-base-300 border">
            <div className="card-body gap-3 p-4">
              <div className="min-w-0">
                <h4 className="line-clamp-1 text-base font-semibold">
                  {doc.title || 'Untitled Document'}
                </h4>
                <code className="text-base-content/70 bg-base-300 rounded-field text-meta mt-1 inline-block px-1.5 py-0.5 break-all">
                  {slug}
                </code>
              </div>

              <div className="border-base-300 grid grid-cols-2 gap-3 border-t pt-3">
                <DocumentFact icon={LuUser} label="Owner">
                  {ownerDisplay || <span className="text-base-content/70">No owner</span>}
                </DocumentFact>
                <DocumentFact icon={LuHistory} label="Versions">
                  {versionCount}
                </DocumentFact>
                <DocumentFact icon={LuMessageSquare} label="Channels">
                  {impact?.workspace ? (
                    channelCount
                  ) : (
                    <span className="text-base-content/70">None</span>
                  )}
                </DocumentFact>
                <DocumentFact icon={LuCalendar} label="Created">
                  {formatDate(doc.createdAt)}
                </DocumentFact>
              </div>
            </div>
          </div>

          {impact?.workspace && (
            <div className="alert alert-soft alert-warning items-start">
              <LuTriangleAlert
                className="mt-0.5 size-4 shrink-0 text-[var(--warning-ink)]"
                aria-hidden
              />
              <p className="text-base-content text-sm">
                <span className="font-medium">Workspace data will be deleted:</span>
                <span className="text-base-content/70 ml-1">
                  {channelCount} channel{channelCount !== 1 ? 's' : ''}, all messages, members, and
                  notifications.
                </span>
              </p>
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
      )}
    </DeleteDocumentDialog>
  )
}
