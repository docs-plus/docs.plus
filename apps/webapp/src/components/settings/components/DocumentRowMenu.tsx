import * as toast from '@components/toast'
import {
  ContextMenuDivider,
  contextMenuPanelClassName,
  ContextMenuRow
} from '@components/ui/ContextMenu'
import { Popover, PopoverContent, PopoverTrigger, usePopoverState } from '@components/ui/Popover'
import Toggle from '@components/ui/Toggle'
import { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'
import { type InfiniteData, useQueryClient } from '@tanstack/react-query'
import { copyToClipboard } from '@utils/clipboard'
import {
  LuCopy,
  LuEllipsisVertical,
  LuExternalLink,
  LuEye,
  LuLink,
  LuLock,
  LuPencilLine,
  LuTrash2
} from 'react-icons/lu'

import { makeDocumentsKey } from '../documentsQueryKey'
import useDuplicateDocument from '../hooks/useDuplicateDocument'
import type { DocumentSortKey, DocumentsPage, OwnedDocument } from '../types'

export interface DocumentRowMenuProps {
  documentId: string
  slug: string
  title: string | null
  isPrivate: boolean
  readOnly: boolean
  userId: string
  searchQuery: string
  sortKey: DocumentSortKey
  onOpenDocument?: () => void
  /** Menu delegates to the row/section (inline rename mode / rename dialog). */
  onRename?: () => void
  /** Section owns the optimistic filter-out + Undo toast; `keyboard` drives focus reconciliation. */
  onDelete?: (keyboard: boolean) => void
  /** Roving-tabindex: -1 for non-active list rows, 0 (default) elsewhere. */
  triggerTabIndex?: number
}

function RowMenuPanel({
  documentId,
  slug,
  title,
  isPrivate,
  readOnly,
  userId,
  searchQuery,
  sortKey,
  onRename,
  onDelete
}: DocumentRowMenuProps) {
  const { close } = usePopoverState()
  const queryClient = useQueryClient()
  const { duplicate, isPending: isDuplicating } = useDuplicateDocument()
  const { setPrivate, setReadOnly, isControlDisabled } = useDocumentAccessMutation({
    documentId,
    userId
  })

  const label = title ?? slug

  const openInNewTab = () => {
    window.open(`/${slug}`, '_blank')
    close()
  }

  const startRename = () => {
    onRename?.()
    close()
  }

  // detail === 0 means the click came from Enter/Space (keyboard), not a pointer.
  const removeDocument = (e: React.MouseEvent) => {
    onDelete?.(e.detail === 0)
    close()
  }

  // Additive post-confirm write — no cancel/snapshot/rollback (nothing to undo).
  // Menu stays open (mirrors patch) so this mutate-scoped onSuccess isn't dropped.
  const runDuplicate = () => {
    const toastId = toast.Loading('Duplicating…')
    duplicate(
      { documentId },
      {
        onSuccess: (copy) => {
          const key = makeDocumentsKey(userId, searchQuery, sortKey)
          const snapshot = queryClient.getQueryData<InfiniteData<DocumentsPage>>(key)
          if (snapshot) {
            const now = new Date().toISOString()
            const created: OwnedDocument = {
              documentId: copy.documentId,
              slug: copy.slug,
              title: copy.title,
              readOnly: false,
              isPrivate: false,
              updatedAt: now,
              createdAt: now
            }
            queryClient.setQueryData(key, {
              ...snapshot,
              pages: snapshot.pages.map((page, i) => ({
                ...page,
                total: page.total + 1,
                docs: i === 0 ? [created, ...page.docs] : page.docs
              }))
            })
          }
          toast.Success(`Copy of “${label}” created`, {
            id: toastId,
            actionLabel: 'Open',
            onAction: () => window.open(`/${copy.slug}`, '_blank')
          })
        },
        onError: () => toast.Error('Couldn’t duplicate document', { id: toastId })
      }
    )
  }

  const copyLink = async () => {
    const ok = await copyToClipboard(`${window.location.origin}/${slug}`)
    if (ok) toast.Success('Link copied!')
    else toast.Error('Couldn’t copy link')
    close()
  }

  return (
    <div className={contextMenuPanelClassName}>
      <button type="button" className="rounded-field group w-full text-left" onClick={openInNewTab}>
        <ContextMenuRow icon={<LuExternalLink size={16} />}>Open in new tab</ContextMenuRow>
      </button>

      {!isPrivate && (
        <button type="button" className="rounded-field group w-full text-left" onClick={copyLink}>
          <ContextMenuRow icon={<LuLink size={16} />}>Copy link</ContextMenuRow>
        </button>
      )}

      <button type="button" className="rounded-field group w-full text-left" onClick={startRename}>
        <ContextMenuRow icon={<LuPencilLine size={16} />}>Rename</ContextMenuRow>
      </button>

      <button
        type="button"
        className="rounded-field group w-full text-left disabled:pointer-events-none disabled:opacity-60"
        disabled={isDuplicating}
        onClick={runDuplicate}>
        <ContextMenuRow icon={<LuCopy size={16} />}>Duplicate</ContextMenuRow>
      </button>

      <ContextMenuDivider />

      <div className="rounded-field flex items-start justify-between gap-2.5 px-2.5 py-2">
        <span className="flex min-w-0 items-start gap-2.5">
          <LuLock size={16} className="text-base-content/70 mt-0.5 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Private</span>
            <span className="text-base-content/60 text-xs">Only you can open this document.</span>
          </span>
        </span>
        <Toggle
          size="sm"
          variant="primary"
          className="shrink-0"
          checked={isPrivate}
          disabled={isControlDisabled('isPrivate')}
          onChange={(e) => setPrivate(e.target.checked)}
          aria-label={`Make “${label}” private`}
        />
      </div>

      <div className="rounded-field flex items-center justify-between gap-2.5 px-2.5 py-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <LuEye size={16} className="text-base-content/70 shrink-0" />
          <span className="text-sm font-medium">Read-only</span>
        </span>
        <Toggle
          size="sm"
          variant="primary"
          className="shrink-0"
          checked={readOnly}
          disabled={isControlDisabled('readOnly')}
          onChange={(e) => setReadOnly(e.target.checked)}
          aria-label={`Make “${label}” read-only`}
        />
      </div>

      <ContextMenuDivider />

      <button
        type="button"
        className="rounded-field group w-full text-left"
        onClick={removeDocument}>
        <ContextMenuRow icon={<LuTrash2 size={16} />} variant="danger">
          Delete
        </ContextMenuRow>
      </button>
    </div>
  )
}

/**
 * Shared ⋮ actions menu for list rows and grid tiles — anchored Popover (light-dismiss),
 * stays open while toggles flip. Copy link hides (optimistically) once Private is on.
 */
function DocumentRowMenu(props: DocumentRowMenuProps) {
  const trigger = props.title ?? props.slug
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Document actions for “${trigger}”`}
          tabIndex={props.triggerTabIndex}
          onClick={(e) => e.stopPropagation()}
          className="text-base-content/50 hover:bg-base-200 hover:text-base-content rounded-field inline-flex min-h-11 min-w-11 items-center justify-center transition-colors sm:min-h-9 sm:min-w-9">
          <LuEllipsisVertical size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <RowMenuPanel {...props} />
      </PopoverContent>
    </Popover>
  )
}

export default DocumentRowMenu
