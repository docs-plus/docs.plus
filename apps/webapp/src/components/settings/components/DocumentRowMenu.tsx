import * as toast from '@components/toast'
import {
  ContextMenuDivider,
  contextMenuPanelClassName,
  ContextMenuRow
} from '@components/ui/ContextMenu'
import { Popover, PopoverContent, PopoverTrigger, usePopoverState } from '@components/ui/Popover'
import Toggle from '@components/ui/Toggle'
import { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'
import { useStore } from '@stores'
import { type InfiniteData, useQueryClient } from '@tanstack/react-query'
import { copyToClipboard } from '@utils/clipboard'
import { useEffect, useRef, useState } from 'react'
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

function RowMenuItems({
  documentId,
  slug,
  title,
  isPrivate,
  readOnly,
  userId,
  searchQuery,
  sortKey,
  onRename,
  onDelete,
  close,
  rowClassName
}: DocumentRowMenuProps & { close: () => void; rowClassName?: string }) {
  const queryClient = useQueryClient()
  const { duplicate, isPending: isDuplicating } = useDuplicateDocument()
  const { setPrivate, setReadOnly, isControlDisabled } = useDocumentAccessMutation({
    documentId,
    userId,
    isPrivate,
    readOnly
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
    <>
      <button type="button" className="rounded-field group w-full text-left" onClick={openInNewTab}>
        <ContextMenuRow icon={<LuExternalLink size={16} />} className={rowClassName}>
          Open in new tab
        </ContextMenuRow>
      </button>

      {!isPrivate && (
        <button type="button" className="rounded-field group w-full text-left" onClick={copyLink}>
          <ContextMenuRow icon={<LuLink size={16} />} className={rowClassName}>
            Copy link
          </ContextMenuRow>
        </button>
      )}

      <button type="button" className="rounded-field group w-full text-left" onClick={startRename}>
        <ContextMenuRow icon={<LuPencilLine size={16} />} className={rowClassName}>
          Rename
        </ContextMenuRow>
      </button>

      <button
        type="button"
        className="rounded-field group w-full text-left disabled:pointer-events-none disabled:opacity-60"
        disabled={isDuplicating}
        onClick={runDuplicate}>
        <ContextMenuRow icon={<LuCopy size={16} />} className={rowClassName}>
          Duplicate
        </ContextMenuRow>
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
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Read-only</span>
            {isPrivate ? (
              <span className="text-base-content/60 text-xs">
                Not used while the document is private.
              </span>
            ) : null}
          </span>
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
        <ContextMenuRow icon={<LuTrash2 size={16} />} variant="danger" className={rowClassName}>
          Delete
        </ContextMenuRow>
      </button>
    </>
  )
}

function RowMenuPopoverPanel(props: DocumentRowMenuProps) {
  const { close } = usePopoverState()
  return (
    <div className={contextMenuPanelClassName}>
      <RowMenuItems {...props} close={close} />
    </div>
  )
}

/**
 * In-tree (not portaled): the settings modal's focus trap and outside-press dismiss must
 * treat the sheet as inside; the full-screen blurred overlay is the fixed containing block.
 */
function RowMenuActionSheet(props: DocumentRowMenuProps & { onClose: () => void }) {
  const { onClose } = props
  const label = props.title ?? props.slug
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sheetRef.current?.focus()
  }, [])

  // Capture-phase Escape closes the sheet before the settings modal's own dismiss sees it —
  // but never while a GlobalDialog confirm (Private ON, delete) is stacked above the sheet.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (useStore.getState().globalDialog.isOpen) return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Dismiss document actions"
        className="absolute inset-0 bg-[var(--modal-scrim)]"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={`Document actions for “${label}”`}
        tabIndex={-1}
        className="rounded-t-box border-base-300 bg-base-100 absolute inset-x-0 bottom-0 border border-b-0 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl outline-none motion-safe:animate-[doc-region-in_180ms_ease-out_both]"
        onClick={(e) => e.stopPropagation()}>
        <div className="bg-base-300 mx-auto mb-1.5 h-1 w-10 rounded-full" aria-hidden />
        <p className="text-base-content/60 truncate px-2.5 pb-1.5 text-xs font-medium">{label}</p>
        <RowMenuItems {...props} close={onClose} rowClassName="min-h-12" />
        <button
          type="button"
          className="rounded-field hover:bg-base-200 mt-1 flex min-h-12 w-full items-center justify-center px-3 text-sm font-semibold"
          onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * Shared ⋮ actions menu for list rows and grid tiles — anchored Popover ≥md, bottom action
 * sheet below md. Stays open while toggles flip; Copy link hides once Private is on.
 */
function DocumentRowMenu(props: DocumentRowMenuProps) {
  const trigger = props.title ?? props.slug
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label={`Document actions for “${trigger}”`}
        aria-expanded={isSheetOpen}
        tabIndex={props.triggerTabIndex}
        onClick={(e) => {
          e.stopPropagation()
          setIsSheetOpen(true)
        }}
        className="text-base-content/50 hover:bg-base-200 hover:text-base-content rounded-field inline-flex min-h-11 min-w-11 items-center justify-center transition-colors md:hidden">
        <LuEllipsisVertical size={18} />
      </button>
      {isSheetOpen && <RowMenuActionSheet {...props} onClose={() => setIsSheetOpen(false)} />}

      <Popover placement="bottom-end">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Document actions for “${trigger}”`}
            tabIndex={props.triggerTabIndex}
            onClick={(e) => e.stopPropagation()}
            className="text-base-content/50 hover:bg-base-200 hover:text-base-content rounded-field inline-flex min-h-9 min-w-9 items-center justify-center transition-colors max-md:hidden">
            <LuEllipsisVertical size={18} />
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <RowMenuPopoverPanel {...props} />
        </PopoverContent>
      </Popover>
    </>
  )
}

export default DocumentRowMenu
