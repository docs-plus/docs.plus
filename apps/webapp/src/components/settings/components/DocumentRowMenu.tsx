import { SheetLayout } from '@components/SheetLayout'
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
import useDuplicateDocument from '../hooks/useDuplicateDocument'
import useToggleDocumentFavorite from '../hooks/useToggleDocumentFavorite'
import type { OwnedDocument } from '../types'
import { documentDisplayName } from '../utils/documentDisplayName'

export interface DocumentRowMenuProps {
  doc: OwnedDocument
  /** The open list. The menu writes every list of `scope.userId`. */
  scope: DocumentsListScope
  /** A non-owned row (joined or ownerless) offers only Open in new tab and Copy link. */
  isOwner: boolean
  /** Menu delegates to the row/section (inline rename mode / rename dialog). */
  onRename?: () => void
  /** Section owns the optimistic filter-out + Undo toast; `keyboard` drives focus reconciliation. */
  onDelete?: (keyboard: boolean) => void
  /** Roving-tabindex: -1 for non-active list rows, 0 (default) elsewhere. */
  triggerTabIndex?: number
}

type ActionRowProps = {
  icon: ReactNode
  children: ReactNode
  variant?: ContextMenuRowVariant
  disabled?: boolean
  ariaLabel?: string
  rowClassName?: string
  onClick: (event: MouseEvent<HTMLElement>) => void
}

type CheckRowProps = {
  icon: ReactNode
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}

/** The row owns the state, so the trailing `Toggle` is only a picture of it. */
function useCheckRowParts({ label, hint, checked, disabled }: CheckRowProps) {
  const hintId = useId()
  return {
    state: { 'aria-checked': checked, 'aria-describedby': hint ? hintId : undefined },
    trailing: (
      <span inert className="flex">
        <Toggle size="sm" variant="primary" checked={checked} disabled={disabled} readOnly />
      </span>
    ),
    // The hint is the row's description, not part of its name.
    body: (
      <span className="flex flex-col">
        {label}
        {hint && (
          <span id={hintId} aria-hidden className="text-meta text-base-content/60 font-normal">
            {hint}
          </span>
        )}
      </span>
    )
  }
}

type RowSet = {
  Action: (props: ActionRowProps) => ReactNode
  Check: (props: CheckRowProps) => ReactNode
  Divider: () => ReactNode
}

/** `MenuItem` rows for the desktop menu. */
const MENU_ROWS: RowSet = {
  Action: ({ icon, children, variant, disabled, ariaLabel, rowClassName, onClick }) => (
    <MenuItem disabled={disabled} aria-label={ariaLabel} onClick={onClick}>
      <ContextMenuRow icon={icon} variant={variant} disabled={disabled} className={rowClassName}>
        {children}
      </ContextMenuRow>
    </MenuItem>
  ),
  Check: function MenuCheckRow(props) {
    const { state, trailing, body } = useCheckRowParts(props)
    return (
      <MenuItem
        role="menuitemcheckbox"
        {...state}
        disabled={props.disabled}
        onClick={props.onToggle}>
        <ContextMenuRow icon={props.icon} disabled={props.disabled} trailing={trailing}>
          {body}
        </ContextMenuRow>
      </MenuItem>
    )
  },
  Divider: () => <ContextMenuDivider />
}

/** Button rows for the phone sheet, which is a dialog and not a menu. */
const SHEET_ROWS: RowSet = {
  Action: ({ icon, children, variant, disabled, ariaLabel, rowClassName, onClick }) => (
    <ContextMenuRowButton
      icon={icon}
      variant={variant}
      disabled={disabled}
      aria-label={ariaLabel}
      rowClassName={twMerge('min-h-12', rowClassName)}
      onClick={onClick}>
      {children}
    </ContextMenuRowButton>
  ),
  Check: function SheetCheckRow(props) {
    const { state, trailing, body } = useCheckRowParts(props)
    return (
      <ContextMenuRowButton
        role="switch"
        {...state}
        icon={props.icon}
        disabled={props.disabled}
        trailing={trailing}
        rowClassName="min-h-12"
        onClick={props.onToggle}>
        {body}
      </ContextMenuRowButton>
    )
  },
  Divider: () => <ContextMenuDivider as="div" />
}

type RowMenuItemsProps = DocumentRowMenuProps & {
  rows: RowSet
  close: () => void
}

/**
 * One body for the menu and the sheet. Each write keeps its side effects in hook-level
 * mutation options, so closing either surface mid-request drops nothing.
 */
function RowMenuItems({ doc, scope, isOwner, onRename, onDelete, rows, close }: RowMenuItemsProps) {
  const { Action, Check, Divider } = rows
  const { documentId, slug, isPrivate, readOnly, isFavorite } = doc
  const docName = documentDisplayName(doc)
  const { duplicate, isPending: isDuplicating } = useDuplicateDocument(scope.userId)
  const { toggleFavorite, isPending: isFavoriting } = useToggleDocumentFavorite(scope.userId)
  const { setPrivate, setReadOnly, isControlDisabled } = useDocumentAccessMutation({
    documentId,
    userId: scope.userId,
    isPrivate,
    readOnly
  })

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

  return (
    <>
      <Action icon={<Icons.externalLink size={16} />} onClick={openInNewTab}>
        Open in new tab
      </Action>

      {!isPrivate && (
        <Action
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
        </Action>
      )}

      {isOwner && (
        <>
          <Divider />

          <Action icon={<Icons.pencilLine size={16} />} onClick={startRename}>
            Rename
          </Action>

          <Action
            icon={<Icons.copy size={16} />}
            disabled={isDuplicating}
            onClick={() => {
              cancel()
              duplicate({ documentId, name: docName })
            }}>
            Duplicate
          </Action>

          <Action
            icon={
              <Icons.star
                size={16}
                className={isFavorite ? 'text-accent fill-accent' : undefined}
              />
            }
            disabled={isFavoriting}
            onClick={() => {
              cancel()
              toggleFavorite({ documentId, favorite: !isFavorite })
            }}>
            {isFavorite ? 'Unfavorite' : 'Favorite'}
          </Action>

          <Divider />

          <Check
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

          <Check
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

          <Divider />

          <Action icon={<Icons.trash size={16} />} variant="danger" onClick={removeDocument}>
            Delete
          </Action>
        </>
      )}
    </>
  )
}

function RowMenuDropdownItems(props: DocumentRowMenuProps) {
  const { setIsOpen } = useContextMenuContext()
  return <RowMenuItems {...props} rows={MENU_ROWS} close={() => setIsOpen(false)} />
}

type DocumentRowMenuSheetData = SheetDataMap['documentRowMenu']

const isRowSheet = (state: ReturnType<typeof useSheetStore.getState>, documentId: string) =>
  state.activeSheet === 'documentRowMenu' &&
  (state.sheetData as DocumentRowMenuSheetData).doc.documentId === documentId

/** Phone body of the house `documentRowMenu` sheet (`BottomSheet` registry). */
export function DocumentRowMenuSheet({
  mountPoint: _mountPoint,
  ...props
}: DocumentRowMenuSheetData) {
  const closeSheet = useSheetStore((state) => state.closeSheet)

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
      title={documentDisplayName(props.doc)}
      onClose={closeSheet}
      className="[&_h2]:truncate"
      bodyClassName="px-1.5 pt-1.5">
      <RowMenuItems {...props} rows={SHEET_ROWS} close={closeSheet} />
    </SheetLayout>
  )
}

/**
 * Shared ⋮ actions menu for list rows and grid tiles — `DropdownMenu` ≥md, house bottom
 * sheet below md. Stays open while toggles flip; Copy link hides once Private is on.
 */
function DocumentRowMenu(props: DocumentRowMenuProps) {
  const { documentId } = props.doc
  const docName = documentDisplayName(props.doc)
  const isSheetOpen = useSheetStore((state) => isRowSheet(state, documentId))

  // The registry renders a snapshot, so push fresh props or the toggles show stale state.
  // Never `openSheet` here: a late prop change after Delete would re-open the sheet.
  useEffect(() => {
    if (!isSheetOpen || !isRowSheet(useSheetStore.getState(), documentId)) return
    useSheetStore.setState((state) => ({
      sheetData: { ...(state.sheetData as DocumentRowMenuSheetData), ...props }
    }))
  }, [isSheetOpen, documentId, props])

  // A gone row must not leave its sheet open: it holds the focus trap and the Back entry.
  useEffect(
    () => () => {
      if (isRowSheet(useSheetStore.getState(), documentId)) useSheetStore.getState().closeSheet()
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
        <RowMenuDropdownItems {...props} />
      </DropdownMenu>
    </>
  )
}

export default DocumentRowMenu
