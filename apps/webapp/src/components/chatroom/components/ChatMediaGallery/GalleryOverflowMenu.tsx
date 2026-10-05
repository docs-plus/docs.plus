import type { GalleryMediaItem } from '@components/chatroom/utils/galleryPlaylist'
import { SheetLayout } from '@components/SheetLayout'
import {
  ContextMenuDivider,
  ContextMenuRow,
  MenuItem,
  useContextMenuContext
} from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import { DropdownMenu } from '@components/ui/DropdownMenu'
import { Icons } from '@icons'
import { useSheetStore } from '@stores'
import { formatMediaFileSize } from '@utils/formatMediaFileSize'
import { twMerge } from '@utils/twMerge'
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react'

import type { GalleryToolbarAction } from './galleryToolbarModel'

export function GalleryPillAction({
  className,
  isMobile,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { isMobile?: boolean }) {
  return (
    <button
      type={type}
      className={twMerge(
        'rounded-field flex shrink-0 touch-manipulation items-center justify-center text-[var(--gallery-text-action)] transition-colors duration-150 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35',
        isMobile ? 'size-11 min-h-11 min-w-11' : 'size-8',
        className
      )}
      {...props}
    />
  )
}

const closeGalleryMenu = () => {
  const { activeSheet, closeSheet } = useSheetStore.getState()
  if (activeSheet === 'galleryMenu') closeSheet()
}

/** The gallery panel. The menu and the sheet mount in it, so the gallery counts them as inside. */
const galleryPanel = (node: Element | null) => node?.closest<HTMLElement>('[role="dialog"]') ?? null

/** Clipboard writes need the click's user gesture, so `onSelect` runs before any close. */
const runAction = (action: GalleryToolbarAction, close: () => void) => {
  void Promise.resolve(action.onSelect()).finally(close)
}

function GalleryMediaDetails({
  media,
  termClassName
}: {
  media: GalleryMediaItem
  termClassName: string
}) {
  const fileName = media.name?.trim() || 'attachment'
  const fileSize = formatMediaFileSize(media.size)

  return (
    <dl className="space-y-3 px-2.5 py-2 text-sm">
      <div>
        <dt className={twMerge('mb-1', termClassName)}>Filename</dt>
        <dd className="font-medium break-all">{fileName}</dd>
      </div>
      <div>
        <dt className={twMerge('mb-1', termClassName)}>Size</dt>
        <dd className="font-medium">{fileSize ?? 'Unknown'}</dd>
      </div>
    </dl>
  )
}

type GalleryRowProps = {
  icon: ReactNode
  label: string
  disabled?: boolean
  trailing?: ReactNode
  expanded?: boolean
  onClick: () => void
}

/** `ContextMenuRow` sizes on the lightbox's dark `--gallery-*` ink, in both app themes. */
function GalleryMenuItem({ icon, label, disabled, trailing, expanded, onClick }: GalleryRowProps) {
  return (
    <MenuItem disabled={disabled} aria-expanded={expanded} onClick={onClick}>
      <ContextMenuRow
        icon={icon}
        disabled={disabled}
        trailing={trailing}
        className={
          disabled
            ? 'text-[var(--gallery-text-muted)]'
            : 'group-hover:bg-[var(--gallery-panel-hover)] group-focus-visible:bg-[var(--gallery-panel-hover)] group-active:bg-[var(--gallery-panel-hover)]'
        }>
        {label}
      </ContextMenuRow>
    </MenuItem>
  )
}

function GallerySheetRow({ icon, label, disabled, trailing, expanded, onClick }: GalleryRowProps) {
  return (
    <ContextMenuRowButton
      icon={icon}
      disabled={disabled}
      trailing={trailing}
      aria-expanded={expanded}
      rowClassName="min-h-12"
      onClick={onClick}>
      {label}
    </ContextMenuRowButton>
  )
}

export type GalleryMenuProps = {
  media: GalleryMediaItem
  overflowPrefix: GalleryToolbarAction[]
  overflowActions: GalleryToolbarAction[]
}

// One row order for the desktop menu and the phone sheet. It unmounts with its host,
// so the details close with the menu.
function GalleryMenuList({
  media,
  overflowPrefix,
  overflowActions,
  asMenu,
  close
}: GalleryMenuProps & { asMenu: boolean; close: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const Row = asMenu ? GalleryMenuItem : GallerySheetRow
  const divider = asMenu ? (
    <ContextMenuDivider className="bg-[var(--gallery-panel-border)]" />
  ) : (
    <ContextMenuDivider as="div" />
  )
  const details = (
    <GalleryMediaDetails
      media={media}
      termClassName={asMenu ? 'text-[var(--gallery-text-muted)]' : 'text-base-content/60'}
    />
  )

  const actionRow = (action: GalleryToolbarAction) => (
    <Row
      key={action.id}
      icon={<action.Icon size={16} />}
      label={action.label}
      disabled={action.disabled}
      onClick={() => runAction(action, close)}
    />
  )

  return (
    <>
      {overflowPrefix.map(actionRow)}
      {overflowPrefix.length > 0 && divider}
      {overflowActions.map(actionRow)}
      <Row
        icon={<Icons.info size={16} />}
        label="View details"
        expanded={detailsOpen}
        trailing={
          <Icons.chevronRight
            size={16}
            aria-hidden
            className={twMerge(
              'opacity-70 motion-safe:transition-transform',
              detailsOpen && 'rotate-90'
            )}
          />
        }
        onClick={() => setDetailsOpen((open) => !open)}
      />
      {detailsOpen && (
        <>
          {divider}
          {asMenu ? (
            // No intrinsic width: a long file name wraps instead of widening the menu.
            <li role="none" className="[contain:inline-size]">
              {details}
            </li>
          ) : (
            details
          )}
        </>
      )}
    </>
  )
}

function GalleryMenuRows(props: GalleryMenuProps) {
  const { setIsOpen } = useContextMenuContext()
  return <GalleryMenuList {...props} asMenu close={() => setIsOpen(false)} />
}

/** Phone body of the house `galleryMenu` sheet (`BottomSheet` registry), in the app theme. */
export function GalleryMenuSheet({ media, overflowPrefix, overflowActions }: GalleryMenuProps) {
  // The sheet mounts in the gallery panel, which sets `text-white`.
  return (
    <SheetLayout
      title="Media actions"
      onClose={closeGalleryMenu}
      className="text-base-content"
      bodyClassName="px-1.5 pt-1.5">
      <GalleryMenuList
        media={media}
        overflowPrefix={overflowPrefix}
        overflowActions={overflowActions}
        asMenu={false}
        close={closeGalleryMenu}
      />
    </SheetLayout>
  )
}

type Props = GalleryMenuProps & { isMobile: boolean }

export function GalleryOverflowMenu({ media, isMobile, overflowPrefix, overflowActions }: Props) {
  const isSheetOpen = useSheetStore((state) => state.activeSheet === 'galleryMenu')
  const panelRef = useRef<HTMLElement | null>(null)

  // The sheet holds a snapshot: a closed gallery or a new slide must not leave it open.
  useEffect(() => closeGalleryMenu, [media])

  if (isMobile) {
    return (
      <GalleryPillAction
        isMobile
        aria-label="Media actions"
        aria-haspopup="dialog"
        aria-expanded={isSheetOpen}
        onClick={(event) => {
          const mountPoint = galleryPanel(event.currentTarget) ?? undefined
          useSheetStore
            .getState()
            .openSheet('galleryMenu', { media, overflowPrefix, overflowActions, mountPoint })
        }}>
        <Icons.moreHorizontal size={18} />
      </GalleryPillAction>
    )
  }

  // Never in place under the pill: its `backdrop-blur` is the containing block for `fixed`.
  return (
    <DropdownMenu
      portalRoot={panelRef}
      className="border-[var(--gallery-panel-border)] bg-[var(--gallery-panel-bg)] text-[var(--gallery-text-primary)]"
      trigger={({ ref, getProps }) => (
        <GalleryPillAction
          ref={(node) => {
            ref(node)
            panelRef.current = galleryPanel(node)
          }}
          {...getProps()}
          aria-label="Media actions">
          <Icons.moreHorizontal size={18} />
        </GalleryPillAction>
      )}>
      <GalleryMenuRows
        media={media}
        overflowPrefix={overflowPrefix}
        overflowActions={overflowActions}
      />
    </DropdownMenu>
  )
}
