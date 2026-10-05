import { SheetLayout } from '@components/SheetLayout'
import * as toast from '@components/toast'
import {
  ContextMenuDivider,
  ContextMenuRow,
  type ContextMenuRowVariant,
  MenuItem,
  useContextMenuContext
} from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import { DropdownMenu } from '@components/ui/DropdownMenu'
import Toggle from '@components/ui/Toggle'
import { useCloseAfterHold } from '@hooks/useCloseAfterHold'
import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'
import { Icons } from '@icons'
import { type SheetDataMap, useSheetStore, useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { type MouseEvent, type ReactNode, useEffect, useId } from 'react'

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

type DocumentAccess = ReturnType<typeof useDocumentAccessMutation>

const useRowAccess = ({ doc, scope }: Pick<DocumentRowMenuProps, 'doc' | 'scope'>) =>
  useDocumentAccessMutation({
    documentId: doc.documentId,
    userId: scope.userId,
    isPrivate: doc.isPrivate,
    readOnly: doc.readOnly
  })

type RowShape = { asMenu: boolean; icon: ReactNode; disabled?: boolean }

type ActionRowProps = RowShape & {
  children: ReactNode
  variant?: ContextMenuRowVariant
  ariaLabel?: string
  rowClassName?: string
  onClick: (event: MouseEvent<HTMLElement>) => void
}

/** A `MenuItem` in the desktop menu; a `ContextMenuRowButton` in the phone sheet (a dialog). */
function ActionRow({
  asMenu,
  icon,
  children,
  variant,
  disabled,
  ariaLabel,
  rowClassName,
  onClick
}: ActionRowProps) {
  if (!asMenu) {
    return (
      <ContextMenuRowButton
        icon={icon}
        variant={variant}
        disabled={disabled}
        aria-label={ariaLabel}
        rowClassName={twMerge('min-h-12', rowClassName)}
        onClick={onClick}>
        {children}
      </ContextMenuRowButton>
    )
  }
  return (
    <MenuItem disabled={disabled} aria-label={ariaLabel} onClick={onClick}>
      <ContextMenuRow icon={icon} variant={variant} disabled={disabled} className={rowClassName}>
        {children}
      </ContextMenuRow>
    </MenuItem>
  )
}

type CheckRowProps = RowShape & {
  label: string
  hint?: string
  checked: boolean
  onToggle: () => void
}

/** The row owns the state, so the trailing `Toggle` is only a picture of it. */
function CheckRow({ asMenu, icon, label, hint, checked, disabled, onToggle }: CheckRowProps) {
  const hintId = useId()
  const state = { 'aria-checked': checked, 'aria-describedby': hint ? hintId : undefined }
  const trailing = (
    <span inert className="flex">
      <Toggle size="sm" variant="primary" checked={checked} disabled={disabled} readOnly />
    </span>
  )
  // The hint is the row's description, not part of its name.
  const body = (
    <span className="flex flex-col">
      {label}
      {hint && (
        <span id={hintId} aria-hidden className="text-meta text-base-content/60 font-normal">
          {hint}
        </span>
      )}
    </span>
  )

  if (!asMenu) {
    return (
      <ContextMenuRowButton
        role="switch"
        {...state}
        icon={icon}
        disabled={disabled}
        trailing={trailing}
        rowClassName="min-h-12"
        onClick={onToggle}>
        {body}
      </ContextMenuRowButton>
    )
  }
  return (
    <MenuItem role="menuitemcheckbox" {...state} disabled={disabled} onClick={onToggle}>
      <ContextMenuRow icon={icon} disabled={disabled} trailing={trailing}>
        {body}
      </ContextMenuRow>
    </MenuItem>
  )
}

type RowMenuItemsProps = DocumentRowMenuProps & {
  asMenu: boolean
  access: DocumentAccess
  close: () => void
}

function RowMenuItems({
  doc,
  scope,
  isOwner,
  onRename,
  onDelete,
  asMenu,
  access,
  close
}: RowMenuItemsProps) {
  const { documentId, slug, title, isPrivate, readOnly, isFavorite } = doc
  const cache = useOwnerDocumentsCache(scope.userId)
  const { duplicate, isPending: isDuplicating } = useDuplicateDocument()
  const { toggleFavorite, isPending: isFavoriting } = useToggleDocumentFavorite()
  const { setPrivate, setReadOnly, isControlDisabled } = access

  const docName = title ?? slug
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
  const removeDocument = (e: MouseEvent<HTMLElement>) => {
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
          toast.Success(`Copy of “${docName}” created`, {
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

  const divider = asMenu ? <ContextMenuDivider /> : <ContextMenuDivider as="div" />

  return (
    <>
      <ActionRow asMenu={asMenu} icon={<Icons.externalLink size={16} />} onClick={openInNewTab}>
        Open in new tab
      </ActionRow>

      {!isPrivate && (
        <ActionRow
          asMenu={asMenu}
          onClick={() => void copy(`${window.location.origin}/${slug}`)}
          ariaLabel={copied ? 'Copied!' : 'Copy link'}
          icon={
            <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
              <Icons.check size={16} className="swap-on text-success" />
              <Icons.link size={16} className="swap-off" />
            </span>
          }
          rowClassName={copied ? 'text-[var(--success-ink)]' : undefined}>
          <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
            <span className="swap-on">Copied!</span>
            <span className="swap-off">Copy link</span>
          </span>
        </ActionRow>
      )}

      {isOwner && (
        <>
          {divider}

          <ActionRow asMenu={asMenu} icon={<Icons.pencilLine size={16} />} onClick={startRename}>
            Rename
          </ActionRow>

          <ActionRow
            asMenu={asMenu}
            icon={<Icons.copy size={16} />}
            disabled={isDuplicating}
            onClick={runDuplicate}>
            Duplicate
          </ActionRow>

          <ActionRow
            asMenu={asMenu}
            icon={
              <Icons.star
                size={16}
                className={isFavorite ? 'text-accent fill-accent' : undefined}
              />
            }
            disabled={isFavoriting}
            onClick={runToggleFavorite}>
            {isFavorite ? 'Unfavorite' : 'Favorite'}
          </ActionRow>

          {divider}

          <CheckRow
            asMenu={asMenu}
            icon={<Icons.lock size={16} />}
            label="Private"
            hint="Only you can open this document."
            checked={isPrivate}
            disabled={isControlDisabled('isPrivate')}
            onToggle={() => {
              cancel()
              setPrivate(!isPrivate)
            }}
          />

          <CheckRow
            asMenu={asMenu}
            icon={<Icons.eye size={16} />}
            label="Read-only"
            hint={isPrivate ? 'Not used while the document is private.' : undefined}
            checked={readOnly}
            disabled={isControlDisabled('readOnly')}
            onToggle={() => {
              cancel()
              setReadOnly(!readOnly)
            }}
          />

          {divider}

          <ActionRow
            asMenu={asMenu}
            icon={<Icons.trash size={16} />}
            variant="danger"
            onClick={removeDocument}>
            Delete
          </ActionRow>
        </>
      )}
    </>
  )
}

function RowMenuDropdownItems(props: Omit<RowMenuItemsProps, 'asMenu' | 'close'>) {
  const { setIsOpen } = useContextMenuContext()
  return <RowMenuItems {...props} asMenu close={() => setIsOpen(false)} />
}

type DocumentRowMenuSheetData = SheetDataMap['documentRowMenu']

/** Phone body of the house `documentRowMenu` sheet (`BottomSheet` registry). */
export function DocumentRowMenuSheet({
  mountPoint: _mountPoint,
  ...props
}: DocumentRowMenuSheetData) {
  const closeSheet = useSheetStore((state) => state.closeSheet)
  // Its own copy until `sheetData` can carry the row's `access` (#391 follow-up).
  // Closing the sheet mid-write still drops that write's rollback and toasts.
  const access = useRowAccess(props)
  const docName = props.doc.title ?? props.doc.slug

  // The sheet and Settings both dismiss on a document keydown. Capture on window runs
  // first and stops it, so Escape closes only the sheet. A GlobalDialog confirm owns Escape.
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
      title={docName}
      onClose={closeSheet}
      className="[&_h2]:truncate"
      bodyClassName="px-1.5 pt-1.5">
      <RowMenuItems {...props} asMenu={false} access={access} close={closeSheet} />
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
 * Shared ⋮ actions menu for list rows and grid tiles — `DropdownMenu` ≥md, house bottom
 * sheet below md. Stays open while toggles flip; Copy link hides once Private is on.
 */
function DocumentRowMenu(props: DocumentRowMenuProps) {
  const { documentId } = props.doc
  const docName = props.doc.title ?? props.doc.slug
  // Lives here, not in the menu: a menu closed mid-write would unmount the mutation,
  // which drops its rollback and toasts.
  const access = useRowAccess(props)
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
        aria-label={`Document actions for “${docName}”`}
        aria-haspopup="dialog"
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
        <Icons.moreVertical size={20} className="stroke-[1.75]" />
      </button>

      <DropdownMenu
        trigger={({ ref, getProps }) => (
          <button
            ref={ref}
            type="button"
            aria-label={`Document actions for “${docName}”`}
            {...getProps({
              tabIndex: props.triggerTabIndex,
              onClick: (e) => e.stopPropagation()
            })}
            className="text-base-content/70 hover:bg-base-200 hover:text-base-content rounded-field focus-visible:ring-primary inline-flex min-h-9 min-w-9 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none max-md:hidden">
            <Icons.moreVertical size={18} />
          </button>
        )}>
        <RowMenuDropdownItems {...props} access={access} />
      </DropdownMenu>
    </>
  )
}

export default DocumentRowMenu
