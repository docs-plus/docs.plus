import { SheetLayout } from '@components/SheetLayout'
import * as toast from '@components/toast'
import { ContextMenuDivider, contextMenuPanelClassName } from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import { Popover, PopoverContent, PopoverTrigger, usePopoverState } from '@components/ui/Popover'
import Toggle from '@components/ui/Toggle'
import { useCloseAfterHold } from '@hooks/useCloseAfterHold'
import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useEffect, useRef, useState } from 'react'
import {
  LuCheck,
  LuCopy,
  LuEllipsisVertical,
  LuExternalLink,
  LuEye,
  LuLink,
  LuLock,
  LuPencilLine,
  LuStar,
  LuTrash2
} from 'react-icons/lu'

import type { DocumentsListScope } from '../documentsQueryKey'
import { useOwnerDocumentsCache } from '../hooks/documentsCache'
import useDuplicateDocument from '../hooks/useDuplicateDocument'
import useToggleDocumentFavorite from '../hooks/useToggleDocumentFavorite'
import type { OwnedDocument } from '../types'

export interface DocumentRowMenuProps {
  doc: OwnedDocument
  /** The one list this menu patches. Both call sites already hold it whole. */
  scope: DocumentsListScope
  onOpenDocument?: () => void
  /** Menu delegates to the row/section (inline rename mode / rename dialog). */
  onRename?: () => void
  /** Section owns the optimistic filter-out + Undo toast; `keyboard` drives focus reconciliation. */
  onDelete?: (keyboard: boolean) => void
  /** Roving-tabindex: -1 for non-active list rows, 0 (default) elsewhere. */
  triggerTabIndex?: number
}

function RowMenuItems({
  doc,
  scope,
  onRename,
  onDelete,
  close,
  rowClassName
}: DocumentRowMenuProps & { close: () => void; rowClassName?: string }) {
  const { documentId, slug, title, isPrivate, readOnly, isFavorite } = doc
  const cache = useOwnerDocumentsCache(scope)
  const { duplicate, isPending: isDuplicating } = useDuplicateDocument()
  const { toggleFavorite, isPending: isFavoriting } = useToggleDocumentFavorite()
  const { setPrivate, setReadOnly, isControlDisabled } = useDocumentAccessMutation({
    documentId,
    userId: scope.userId,
    isPrivate,
    readOnly
  })

  const label = title ?? slug
  const { schedule, cancel } = useCloseAfterHold(close)
  const { copy, copied } = useCopyToClipboard({
    successMessage: 'Link copied!',
    errorMessage: 'Couldn’t copy link',
    onSuccess: schedule
  })

  const closeNow = () => {
    cancel()
    close()
  }

  const openInNewTab = () => {
    window.open(`/${slug}`, '_blank')
    closeNow()
  }

  const startRename = () => {
    onRename?.()
    closeNow()
  }

  // detail === 0 means the click came from Enter/Space (keyboard), not a pointer.
  const removeDocument = (e: React.MouseEvent) => {
    onDelete?.(e.detail === 0)
    closeNow()
  }

  // Additive post-confirm write — no cancel/snapshot/rollback (nothing to undo).
  // Menu stays open (mirrors patch) so this mutate-scoped onSuccess isn't dropped.
  const runDuplicate = () => {
    cancel()
    const toastId = toast.Loading('Duplicating…')
    duplicate(
      { documentId },
      {
        onSuccess: (copy) => {
          cache.addDuplicate()
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

  const runToggleFavorite = () => {
    cancel()
    const next = !isFavorite
    void cache.setFavorite(documentId, next).then((rollback) => {
      toggleFavorite(
        { documentId, favorite: next },
        {
          onError: () => {
            rollback?.()
            toast.Error('Couldn’t update favorite')
          }
        }
      )
    })
  }

  // The toggles sit between the rows, so the panel stays plain buttons, not `MenuItem`.
  return (
    <>
      <ContextMenuRowButton
        icon={<LuExternalLink size={16} />}
        rowClassName={rowClassName}
        onClick={openInNewTab}>
        Open in new tab
      </ContextMenuRowButton>

      {!isPrivate && (
        <ContextMenuRowButton
          onClick={() => void copy(`${window.location.origin}/${slug}`)}
          aria-label={copied ? 'Copied!' : 'Copy link'}
          icon={
            <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
              <LuCheck size={16} className="swap-on text-success" />
              <LuLink size={16} className="swap-off" />
            </span>
          }
          rowClassName={twMerge(rowClassName, copied && 'text-[var(--success-ink)]')}>
          <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
            <span className="swap-on">Copied!</span>
            <span className="swap-off">Copy link</span>
          </span>
        </ContextMenuRowButton>
      )}

      <ContextMenuRowButton
        icon={<LuPencilLine size={16} />}
        rowClassName={rowClassName}
        onClick={startRename}>
        Rename
      </ContextMenuRowButton>

      <ContextMenuRowButton
        icon={<LuCopy size={16} />}
        disabled={isDuplicating}
        rowClassName={rowClassName}
        onClick={runDuplicate}>
        Duplicate
      </ContextMenuRowButton>

      <ContextMenuRowButton
        icon={<LuStar size={16} className={isFavorite ? 'text-accent fill-accent' : undefined} />}
        disabled={isFavoriting}
        rowClassName={rowClassName}
        onClick={runToggleFavorite}>
        {isFavorite ? 'Unfavorite' : 'Favorite'}
      </ContextMenuRowButton>

      <ContextMenuDivider as="div" />

      <div className="rounded-field flex items-start justify-between gap-2.5 px-2.5 py-2">
        <span className="flex min-w-0 items-start gap-2.5">
          <LuLock size={16} className="text-base-content/70 mt-0.5 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Private</span>
            <span className="text-meta text-base-content/60">Only you can open this document.</span>
          </span>
        </span>
        <Toggle
          size="sm"
          variant="primary"
          className="shrink-0"
          checked={isPrivate}
          disabled={isControlDisabled('isPrivate')}
          onChange={(e) => {
            cancel()
            setPrivate(e.target.checked)
          }}
          aria-label={`Make “${label}” private`}
        />
      </div>

      <div className="rounded-field flex items-center justify-between gap-2.5 px-2.5 py-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <LuEye size={16} className="text-base-content/70 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Read-only</span>
            {isPrivate ? (
              <span className="text-meta text-base-content/60">
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
          onChange={(e) => {
            cancel()
            setReadOnly(e.target.checked)
          }}
          aria-label={`Make “${label}” read-only`}
        />
      </div>

      <ContextMenuDivider as="div" />

      <ContextMenuRowButton
        icon={<LuTrash2 size={16} />}
        variant="danger"
        rowClassName={rowClassName}
        onClick={removeDocument}>
        Delete
      </ContextMenuRowButton>
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
 * In-tree, not portaled. The settings modal's focus trap and outside-press dismiss must
 * treat the sheet as inside. The full-screen blurred overlay is the fixed containing block.
 */
function RowMenuActionSheet(props: DocumentRowMenuProps & { onClose: () => void }) {
  const { onClose } = props
  const label = props.doc.title ?? props.doc.slug
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sheetRef.current?.focus()
  }, [])

  // Capture-phase Escape closes the sheet before the settings modal's own dismiss sees it.
  // Never close while a GlobalDialog confirm (Private ON, delete) is stacked above the sheet.
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
      {/* No grabber: nothing drags this sheet. `pt-3` stands in for the library grabber row
          that the SheetLayout header's `pt-1` expects. The safe-area pad comes from SheetLayout. */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={`Document actions for “${label}”`}
        tabIndex={-1}
        className="rounded-t-box bg-base-100 absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-hidden pt-3 outline-none motion-safe:animate-[doc-region-in_180ms_ease-out_both]"
        onClick={(e) => e.stopPropagation()}>
        <SheetLayout
          title={label}
          onClose={onClose}
          className="min-h-0 [&_h2]:truncate"
          bodyClassName="px-1.5 pt-1.5">
          <RowMenuItems {...props} close={onClose} rowClassName="min-h-12" />
        </SheetLayout>
      </div>
    </div>
  )
}

/**
 * Shared ⋮ actions menu for list rows and grid tiles — anchored Popover ≥md, bottom action
 * sheet below md. Stays open while toggles flip; Copy link hides once Private is on.
 */
function DocumentRowMenu(props: DocumentRowMenuProps) {
  const trigger = props.doc.title ?? props.doc.slug
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
        className="text-base-content/70 hover:bg-base-200 hover:text-base-content rounded-field focus-visible:ring-primary inline-flex min-h-11 min-w-11 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none md:hidden">
        <LuEllipsisVertical size={20} className="stroke-[1.75]" />
      </button>
      {isSheetOpen && <RowMenuActionSheet {...props} onClose={() => setIsSheetOpen(false)} />}

      <Popover placement="bottom-end">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Document actions for “${trigger}”`}
            tabIndex={props.triggerTabIndex}
            onClick={(e) => e.stopPropagation()}
            className="text-base-content/70 hover:bg-base-200 hover:text-base-content rounded-field focus-visible:ring-primary inline-flex min-h-9 min-w-9 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none max-md:hidden">
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
