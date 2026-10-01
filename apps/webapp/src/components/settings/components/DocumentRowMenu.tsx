import { SheetLayout } from '@components/SheetLayout'
import * as toast from '@components/toast'
import { ContextMenuDivider, contextMenuPanelClassName } from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import { Popover, PopoverContent, PopoverTrigger, usePopoverState } from '@components/ui/Popover'
import Toggle from '@components/ui/Toggle'
import { useCloseAfterHold } from '@hooks/useCloseAfterHold'
import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'
import { type SheetDataMap, useSheetStore, useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useEffect } from 'react'
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
  /** The open list. The menu writes every list of `scope.userId`. */
  scope: DocumentsListScope
  /** A non-owned row (joined or ownerless) offers only Open in new tab and Copy link. */
  isOwner: boolean
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
  isOwner,
  onRename,
  onDelete,
  close,
  rowClassName
}: DocumentRowMenuProps & { close: () => void; rowClassName?: string }) {
  const { documentId, slug, title, isPrivate, readOnly, isFavorite } = doc
  const cache = useOwnerDocumentsCache(scope.userId)
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

      {isOwner && (
        <>
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
            icon={
              <LuStar size={16} className={isFavorite ? 'text-accent fill-accent' : undefined} />
            }
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
                <span className="text-meta text-base-content/60">
                  Only you can open this document.
                </span>
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
      )}
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

type DocumentRowMenuSheetData = SheetDataMap['documentRowMenu']

/** Phone body of the house `documentRowMenu` sheet (`BottomSheet` registry). */
export function DocumentRowMenuSheet({
  mountPoint: _mountPoint,
  ...props
}: DocumentRowMenuSheetData) {
  const closeSheet = useSheetStore((state) => state.closeSheet)

  // The sheet and Settings both dismiss on a document keydown, so one Escape closed both.
  // Capture on window runs first and stops it. A GlobalDialog confirm above owns Escape.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || useStore.getState().globalDialog.isOpen) return
      event.stopPropagation()
      closeSheet()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [closeSheet])

  return (
    <SheetLayout
      title={props.doc.title ?? props.doc.slug}
      onClose={closeSheet}
      className="[&_h2]:truncate"
      bodyClassName="px-1.5 pt-1.5">
      <RowMenuItems {...props} close={closeSheet} rowClassName="min-h-12" />
    </SheetLayout>
  )
}

const isSheetFor = (documentId: string): boolean => {
  const { activeSheet, sheetData } = useSheetStore.getState()
  return (
    activeSheet === 'documentRowMenu' &&
    (sheetData as DocumentRowMenuSheetData).doc.documentId === documentId
  )
}

/**
 * Shared ⋮ actions menu for list rows and grid tiles — anchored Popover ≥md, house bottom
 * sheet below md. Stays open while toggles flip; Copy link hides once Private is on.
 */
function DocumentRowMenu(props: DocumentRowMenuProps) {
  const { documentId } = props.doc
  const trigger = props.doc.title ?? props.doc.slug
  const isSheetOpen = useSheetStore(
    (state) =>
      state.activeSheet === 'documentRowMenu' &&
      (state.sheetData as DocumentRowMenuSheetData).doc.documentId === documentId
  )

  // The registry renders a snapshot, so push fresh props or the toggles show stale state.
  // Never `openSheet` here: a late prop change after Delete would re-open the sheet.
  useEffect(() => {
    if (!isSheetOpen || !isSheetFor(documentId)) return
    useSheetStore.setState((state) => ({
      sheetData: { ...(state.sheetData as DocumentRowMenuSheetData), ...props }
    }))
  }, [isSheetOpen, documentId, props])

  // A gone row must not leave its sheet open: it holds the focus trap and the Back entry.
  useEffect(
    () => () => {
      if (isSheetFor(documentId)) useSheetStore.getState().closeSheet()
    },
    [documentId]
  )

  return (
    <>
      <button
        type="button"
        aria-label={`Document actions for “${trigger}”`}
        aria-expanded={isSheetOpen}
        tabIndex={props.triggerTabIndex}
        onClick={(e) => {
          e.stopPropagation()
          // Mount inside the Settings panel: its outside-press dismiss, focus trap and
          // aria-hidden then treat the sheet as inside. A body portal would close Settings.
          const mountPoint = e.currentTarget.closest<HTMLElement>('[role="dialog"]') ?? undefined
          useSheetStore.getState().openSheet('documentRowMenu', { ...props, mountPoint })
        }}
        className="text-base-content/70 hover:bg-base-200 hover:text-base-content rounded-field focus-visible:ring-primary inline-flex min-h-11 min-w-11 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none md:hidden">
        <LuEllipsisVertical size={20} className="stroke-[1.75]" />
      </button>

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
