import {
  copyMediaImage,
  copyResolvedMediaLink,
  openResolvedMediaLink
} from '@components/chatroom/utils/galleryMediaActions'
import type {
  GalleryMediaItem,
  GallerySourceContext
} from '@components/chatroom/utils/galleryPlaylist'
import { Avatar } from '@components/ui/Avatar'
import { Icons } from '@icons'
import { useStore } from '@stores'
import type { TMsgRow } from '@types'
import { formatMediaFileSize } from '@utils/formatMediaFileSize'
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { twMerge } from 'tailwind-merge'

function GalleryPillAction({
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
  disabled
}: {
  label: string
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        className="group rounded-field flex w-full cursor-pointer items-center justify-between gap-4 px-2.5 py-2 text-left text-sm text-[var(--gallery-text-primary)] transition-colors duration-150 hover:bg-[var(--gallery-panel-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onSelect}>
        <span className="font-medium">{label}</span>
        <span className="shrink-0 text-[var(--gallery-text-muted)]">{icon}</span>
      </button>
    </li>
  )
}

function GalleryMediaDetailsPanel({ media }: { media: GalleryMediaItem }) {
  const fileName = media.name?.trim() || 'attachment'
  const fileSize = formatMediaFileSize(media.size)

  return (
    <div className="rounded-box absolute top-0 right-full z-10 mr-2 w-52 border border-[var(--gallery-panel-border)] bg-[var(--gallery-panel-bg)] p-3 text-[var(--gallery-text-primary)] shadow-xl backdrop-blur-md">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="mb-1 text-[var(--gallery-text-muted)]">Filename</dt>
          <dd className="font-medium break-all text-[var(--gallery-text-primary)]">{fileName}</dd>
        </div>
        <div>
          <dt className="mb-1 text-[var(--gallery-text-muted)]">Size</dt>
          <dd className="font-medium text-[var(--gallery-text-primary)]">
            {fileSize ?? 'Unknown'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function GalleryOverflowMenu({
  media,
  activeResolvedUrl,
  isMobile
}: {
  media: GalleryMediaItem
  activeResolvedUrl: string | null
  isMobile: boolean
}) {
  const [open, setOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const isImage = media.type === 'image'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
      setDetailsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setDetailsOpen(false)
  }, [])

  const run = (action: () => void | Promise<unknown>) => {
    void Promise.resolve(action()).finally(closeMenu)
  }

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

      {open ? (
        <div
          role="menu"
          className="rounded-box absolute top-[calc(100%+0.5rem)] right-0 z-[110] w-56 border border-[var(--gallery-panel-border)] bg-[var(--gallery-panel-bg)] p-1.5 text-[var(--gallery-text-primary)] shadow-xl backdrop-blur-md"
          onClick={(event) => event.stopPropagation()}>
          <div className="relative">
            {detailsOpen ? <GalleryMediaDetailsPanel media={media} /> : null}
            <ul className="flex list-none flex-col">
              {isImage ? (
                <GalleryMenuRow
                  label="Copy Image"
                  icon={<Icons.copy size={16} />}
                  onSelect={() =>
                    void run(async () => {
                      await copyMediaImage(media, activeResolvedUrl)
                    })
                  }
                />
              ) : null}
              <GalleryMenuRow
                label="Copy Media Link"
                icon={<Icons.link size={16} />}
                onSelect={() => void run(() => copyResolvedMediaLink(activeResolvedUrl))}
              />
              <li>
                <button
                  type="button"
                  className="group rounded-field flex w-full cursor-pointer items-center justify-between gap-4 px-2.5 py-2 text-left text-sm text-[var(--gallery-text-primary)] transition-colors duration-150 hover:bg-[var(--gallery-panel-hover)]"
                  onClick={() => setDetailsOpen((value) => !value)}>
                  <span className="font-medium">View Details</span>
                  <Icons.chevronRight size={16} className="text-[var(--gallery-text-muted)]" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type Props = {
  media: GalleryMediaItem
  multiItem: boolean
  index: number
  total: number
  slideZoomed: boolean
  controlsVisible: boolean
  controlsMotionStyle?: { transitionDuration: string }
  downloading: boolean
  source: GallerySourceContext | null
  caption: string | null
  originMessage: TMsgRow | null
  activeResolvedUrl: string | null
  onClose: () => void
  onDownload: () => void
  onZoomIn: () => void
  onZoomReset: () => void
  onReply: () => void
}

export function GalleryToolbar({
  media,
  multiItem,
  index,
  total,
  slideZoomed,
  controlsVisible,
  controlsMotionStyle,
  downloading,
  source,
  caption,
  originMessage,
  activeResolvedUrl,
  onClose,
  onDownload,
  onZoomIn,
  onZoomReset,
  onReply
}: Props) {
  const isMobile = Boolean(useStore((state) => state.settings.editor.isMobile))
  const isImage = media.type === 'image'
  const controlsHideClass = twMerge(
    'motion-safe:transition-opacity',
    !controlsVisible && 'pointer-events-none opacity-0'
  )
  const panelShell =
    'rounded-box border border-[var(--gallery-panel-border)] bg-[var(--gallery-panel-bg)] text-[var(--gallery-text-primary)] shadow-xl backdrop-blur-md'

  return (
    <>
      <div
        className={twMerge(
          'pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-6 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3',
          controlsHideClass
        )}
        style={controlsMotionStyle}>
        {source?.authorName ? (
          <div
            className={twMerge(
              'flex max-w-[min(52vw,22rem)] min-w-0 items-start gap-2.5',
              controlsVisible && 'pointer-events-auto'
            )}>
            <Avatar
              size="sm"
              src={source.authorAvatarUrl}
              avatarUpdatedAt={source.authorAvatarUpdatedAt}
              id={source.authorUserId ?? undefined}
              alt={source.authorName}
              clickable={false}
              className="shrink-0 bg-transparent !ring-0"
            />
            <div className="min-w-0 self-center leading-none">
              <p className="truncate text-[15px] leading-5 font-semibold text-[var(--gallery-text-heading)]">
                {source.authorName}
              </p>
              {source.sentAtLabel ? (
                <p className="mt-0.5 truncate text-xs leading-4 text-[var(--gallery-text-muted)]">
                  {source.sentAtLabel}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <div
          className={twMerge(
            'flex shrink-0 items-center gap-2',
            controlsVisible && 'pointer-events-auto'
          )}>
          <div
            role="toolbar"
            aria-label="Media actions"
            className={twMerge(panelShell, 'flex items-center gap-0.5 px-1 py-1')}>
            {isImage ? (
              <GalleryPillAction
                isMobile={isMobile}
                aria-label={slideZoomed ? 'Fit image to screen' : 'Zoom in'}
                onClick={() => (slideZoomed ? onZoomReset() : onZoomIn())}>
                {slideZoomed ? <Icons.zoomOut size={18} /> : <Icons.zoomIn size={18} />}
              </GalleryPillAction>
            ) : null}

            {originMessage ? (
              <GalleryPillAction isMobile={isMobile} aria-label="Reply" onClick={onReply}>
                <Icons.reply size={18} />
              </GalleryPillAction>
            ) : null}

            <GalleryPillAction
              isMobile={isMobile}
              aria-label="Download media"
              disabled={downloading}
              onClick={onDownload}>
              <Icons.download size={18} />
            </GalleryPillAction>

            <GalleryPillAction
              isMobile={isMobile}
              aria-label="Open media in browser"
              onClick={() => openResolvedMediaLink(activeResolvedUrl)}>
              <Icons.externalLink size={18} />
            </GalleryPillAction>

            <GalleryOverflowMenu
              media={media}
              activeResolvedUrl={activeResolvedUrl}
              isMobile={isMobile}
            />
          </div>

          <GalleryPillAction
            isMobile={isMobile}
            className={twMerge(panelShell, isMobile ? undefined : 'size-9')}
            aria-label="Close gallery"
            onClick={onClose}>
            <Icons.close size={20} />
          </GalleryPillAction>
        </div>
      </div>

      {media.name?.trim() ? <span className="sr-only">{media.name.trim()}</span> : null}

      {multiItem ? (
        <div
          className={twMerge(
            'pointer-events-none absolute inset-x-0 top-[max(3.75rem,env(safe-area-inset-top))] z-30 flex justify-center',
            controlsHideClass
          )}
          style={controlsMotionStyle}>
          <span className="rounded-full bg-[var(--gallery-panel-bg)]/90 px-2.5 py-0.5 text-xs text-[var(--gallery-text-action)] tabular-nums ring-1 ring-white/[0.08] backdrop-blur-md">
            {index + 1} / {total}
          </span>
        </div>
      ) : null}

      {caption ? (
        <div
          className={twMerge(
            'pointer-events-none absolute inset-x-0 bottom-0 z-40 px-6 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] text-center',
            controlsHideClass
          )}
          style={controlsMotionStyle}>
          <p className="line-clamp-2 text-sm text-[var(--gallery-text-primary)]">{caption}</p>
        </div>
      ) : null}
    </>
  )
}
