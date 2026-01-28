import { useState, useEffect } from 'react';
import {
  LuTrash2,
  LuTriangleAlert,
  LuUser,
  LuMessageSquare,
  LuHistory,
  LuCalendar,
} from 'react-icons/lu';
import { getDocumentDeletionImpact, type DeletionImpact } from '@/services/api';
import { formatDate } from '@/utils/format';
import type { Document } from '@/types';

interface DeleteModalProps {
  isOpen: boolean;
  doc: Document | null;
  onConfirm: (confirmSlug: string) => void;
  onCancel: () => void;
  isDeleting: boolean;
}

/**
 * Delete confirmation modal with document details and impact preview
 * Requires user to type the document slug to confirm deletion
 */
export function DeleteModal({
  isOpen,
  doc,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch impact when modal opens
  useEffect(() => {
    if (isOpen && doc) {
      setConfirmInput('');
      setImpact(null);
      setLoading(true);
      getDocumentDeletionImpact(doc.id)
        .then(setImpact)
        .catch(() => setImpact(null))
        .finally(() => setLoading(false));
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const slug = doc.docId;
  const canDelete = confirmInput === slug && !loading;

  const handleConfirm = () => {
    if (canDelete) onConfirm(confirmInput);
  };

  const ownerDisplay = impact?.owner?.username || impact?.owner?.email?.split('@')[0] || null;
  const channelCount = impact?.workspace?.channelCount ?? 0;
  const versionCount = impact?.document.versionCount ?? doc.versionCount;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        {/* Header */}
        <div className="flex items-start gap-4 pb-4 border-b border-base-300">
          <div className="bg-error/10 p-3 rounded-xl">
            <LuTrash2 className="h-6 w-6 text-error" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">Delete Document</h3>
            <p className="text-sm text-base-content/60 mt-0.5">
              This action is permanent and cannot be undone.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="text-sm text-base-content/60">Loading document details...</p>
          </div>
        ) : (
          <div className="py-5 space-y-5">
            {/* Document Card */}
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body p-4 gap-3">
                {/* Title & Slug */}
                <div>
                  <h4 className="font-semibold text-base line-clamp-1">
                    {doc.title || 'Untitled Document'}
                  </h4>
                  <code className="text-xs text-base-content/50 bg-base-300 px-1.5 py-0.5 rounded mt-1 inline-block">
                    {slug}
                  </code>
                </div>

                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-base-300">
                  {/* Owner */}
                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 p-1.5 rounded-lg">
                      <LuUser className="h-3.5 w-3.5 text-base-content/60" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-base-content/40 font-medium">Owner</p>
                      <p className="text-sm font-medium truncate">
                        {ownerDisplay || <span className="text-base-content/40">No owner</span>}
                      </p>
                    </div>
                  </div>

                  {/* Versions */}
                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 p-1.5 rounded-lg">
                      <LuHistory className="h-3.5 w-3.5 text-base-content/60" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-base-content/40 font-medium">Versions</p>
                      <p className="text-sm font-medium">{versionCount}</p>
                    </div>
                  </div>

                  {/* Channels */}
                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 p-1.5 rounded-lg">
                      <LuMessageSquare className="h-3.5 w-3.5 text-base-content/60" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-base-content/40 font-medium">Channels</p>
                      <p className="text-sm font-medium">
                        {impact?.workspace ? channelCount : <span className="text-base-content/40">None</span>}
                      </p>
                    </div>
                  </div>

                  {/* Created */}
                  <div className="flex items-center gap-2">
                    <div className="bg-base-300 p-1.5 rounded-lg">
                      <LuCalendar className="h-3.5 w-3.5 text-base-content/60" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-base-content/40 font-medium">Created</p>
                      <p className="text-sm font-medium">{formatDate(doc.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Alert */}
            {impact?.workspace && (
              <div className="alert bg-warning/10 border border-warning/20 text-warning-content">
                <LuTriangleAlert className="h-5 w-5 text-warning shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Workspace data will be deleted:</span>
                  <span className="text-base-content/70 ml-1">
                    {channelCount} channel{channelCount !== 1 ? 's' : ''}, all messages, members, and notifications.
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
        <div className="flex gap-3 pt-4 border-t border-base-300">
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error flex-1"
            onClick={handleConfirm}
            disabled={!canDelete || isDeleting}
          >
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
  );
}
