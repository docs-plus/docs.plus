import type { GalleryMediaItem } from '@components/chatroom/utils/galleryPlaylist'
import { Icons } from '@icons'
import { formatMediaFileSize } from '@utils/formatMediaFileSize'
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'

import { galleryLightboxThemeStyle } from './galleryTheme'
import type { GalleryToolbarAction } from './galleryToolbarModel'

export function GalleryPillAction({
  className,
  isMobile,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { isMobile?: boolean }) {
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

function GalleryMenuRow({
  label,
  icon,
  onSelect,
  disabled,
  compact
}: {
  label: string
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
  /** Desktop dropdown: icon trailing. Mobile sheet: icon leading + 48px rows. */
  compact?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        className={twMerge(
          'group rounded-field flex w-full cursor-pointer items-center gap-3 text-left text-sm text-[var(--gallery-text-primary)] transition-colors duration-150 hover:bg-[var(--gallery-panel-hover)] disabled:cursor-not-allowed disabled:opacity-40',
          compact
            ? 'flex-row-reverse justify-between gap-4 px-2.5 py-2'
            : 'min-h-12 px-3 py-3 active:bg-[var(--gallery-panel-hover)]'
        )}
        onClick={onSelect}>
        <span className="shrink-0 text-[var(--gallery-text-muted)]">{icon}</span>
        <span className="min-w-0 flex-1 font-medium">{label}</span>
      </button>
    </li>
  )
}

function GalleryMediaDetails({
  media,
  variant
}: {
  media: GalleryMediaItem
  variant: 'flyout' | 'inline'
}) {
  const fileName = media.name?.trim() || 'attachment'
  const fileSize = formatMediaFileSize(media.size)

  const body = (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="mb-1 text-[var(--gallery-text-muted)]">Filename</dt>
        <dd className="font-medium break-all text-[var(--gallery-text-primary)]">{fileName}</dd>
      </div>
      <div>
        <dt className="mb-1 text-[var(--gallery-text-muted)]">Size</dt>
        <dd className="font-medium text-[var(--gallery-text-primary)]">{fileSize ?? 'Unknown'}</dd>
      </div>
    </dl>
  )

  if (variant === 'inline') {
    return (
      <div className="border-t border-[var(--gallery-panel-border)] px-3 pt-3 pb-1 text-[var(--gallery-text-primary)]">
        {body}
      </div>
    )
  }

  return (
    <div className="rounded-box absolute top-0 right-full z-10 mr-2 w-52 border border-[var(--gallery-panel-border)] bg-[var(--gallery-panel-bg)] p-3 text-[var(--gallery-text-primary)] shadow-xl backdrop-blur-md">
      {body}
    </div>
  )
}

function GalleryOverflowMenuList({
  media,
  compact,
  overflowPrefix,
  overflowActions,
  detailsOpen,
  onToggleDetails,
  onRun
}: {
  media: GalleryMediaItem
  compact: boolean
  overflowPrefix: GalleryToolbarAction[]
  overflowActions: GalleryToolbarAction[]
  detailsOpen: boolean
  onToggleDetails: () => void
  onRun: (action: () => void | Promise<unknown>) => void
}) {
  return (
    <div className="relative">
      {detailsOpen && compact ? <GalleryMediaDetails media={media} variant="flyout" /> : null}
      <ul className="flex list-none flex-col">
        {overflowPrefix.map((action) => (
          <GalleryMenuRow
            key={action.id}
            label={action.label}
            icon={<action.Icon size={compact ? 16 : 18} />}
            disabled={action.disabled}
            compact={compact}
            onSelect={() => onRun(action.onSelect)}
          />
        ))}
        {overflowPrefix.length > 0 ? (
          <li role="separator" className="my-1 h-px bg-[var(--gallery-panel-border)]" />
        ) : null}
        {overflowActions.map((action) => (
          <GalleryMenuRow
            key={action.id}
            label={action.label}
            icon={<action.Icon size={compact ? 16 : 18} />}
            disabled={action.disabled}
            compact={compact}
            onSelect={() => onRun(action.onSelect)}
          />
        ))}
        <li>
          <button
            type="button"
            className={twMerge(
              'group rounded-field flex w-full cursor-pointer items-center gap-3 text-left text-sm text-[var(--gallery-text-primary)] transition-colors duration-150 hover:bg-[var(--gallery-panel-hover)]',
              compact
                ? 'flex-row-reverse justify-between gap-4 px-2.5 py-2'
                : 'min-h-12 px-3 py-3 active:bg-[var(--gallery-panel-hover)]'
            )}
            onClick={onToggleDetails}>
            {compact ? (
              <Icons.chevronRight size={16} className="shrink-0 text-[var(--gallery-text-muted)]" />
            ) : (
              <Icons.info size={18} className="shrink-0 text-[var(--gallery-text-muted)]" />
            )}
            <span className="min-w-0 flex-1 font-medium">View Details</span>
            {!compact ? (
              <Icons.chevronRight
                size={16}
                className={twMerge(
                  'shrink-0 text-[var(--gallery-text-muted)] transition-transform duration-150',
                  detailsOpen && 'rotate-90'
                )}
              />
            ) : null}
          </button>
        </li>
      </ul>
      {detailsOpen && !compact ? <GalleryMediaDetails media={media} variant="inline" /> : null}
    </div>
  )
}

type Props = {
  media: GalleryMediaItem
  isMobile: boolean
  overflowPrefix: GalleryToolbarAction[]
  overflowActions: GalleryToolbarAction[]
}

export function GalleryOverflowMenu({ media, isMobile, overflowPrefix, overflowActions }: Props) {
  const [open, setOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || sheetRef.current?.contains(target)) return
      setOpen(false)
      setDetailsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      setDetailsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setDetailsOpen(false)
  }, [])

  const run = (action: () => void | Promise<unknown>) => {
    void Promise.resolve(action()).finally(closeMenu)
  }

  const menuList = (
    <GalleryOverflowMenuList
      media={media}
      compact={!isMobile}
      overflowPrefix={overflowPrefix}
      overflowActions={overflowActions}
      detailsOpen={detailsOpen}
      onToggleDetails={() => setDetailsOpen((value) => !value)}
      onRun={run}
    />
  )

  // Portal: pill `backdrop-blur` traps `position: fixed` and collapses the sheet into the ⋯ button.
  const mobileSheet =
    open && isMobile && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={sheetRef}
            className="fixed inset-0 z-[120]"
            style={galleryLightboxThemeStyle}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label="Dismiss media actions"
              className="absolute inset-0 bg-black/50"
              onClick={closeMenu}
            />
            <div
              role="menu"
              aria-label="Media actions"
              className="rounded-t-box absolute inset-x-0 bottom-0 border border-b-0 border-[var(--gallery-panel-border)] bg-[var(--gallery-panel-bg)] px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[var(--gallery-text-primary)] shadow-xl backdrop-blur-md motion-safe:animate-[doc-region-in_180ms_ease-out_both]">
              <div
                className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--gallery-panel-border)]"
                aria-hidden
              />
              {menuList}
              <button
                type="button"
                className="rounded-field mt-1 flex min-h-12 w-full items-center justify-center px-3 text-sm font-semibold text-[var(--gallery-text-primary)] transition-colors hover:bg-[var(--gallery-panel-hover)]"
                onClick={closeMenu}>
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className="relative">
      <GalleryPillAction
        isMobile={isMobile}
        aria-label="Media actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}>
        <Icons.moreHorizontal size={18} />
      </GalleryPillAction>

      {open && !isMobile ? (
        <div
          role="menu"
          className="rounded-box absolute top-[calc(100%+0.5rem)] right-0 z-[110] w-56 border border-[var(--gallery-panel-border)] bg-[var(--gallery-panel-bg)] p-1.5 text-[var(--gallery-text-primary)] shadow-xl backdrop-blur-md"
          onClick={(event) => event.stopPropagation()}>
          {menuList}
        </div>
      ) : null}

      {mobileSheet}
    </div>
  )
}
