import type {
  GalleryMediaItem,
  GallerySourceContext
} from '@components/chatroom/utils/galleryPlaylist'
import { Avatar } from '@components/ui/Avatar'
import { Icons } from '@icons'
import { useStore } from '@stores'
import type { TMsgRow } from '@types'
import { type CSSProperties } from 'react'
import { twMerge } from 'tailwind-merge'

import { GalleryOverflowMenu, GalleryPillAction } from './GalleryOverflowMenu'
import {
  actionsOnSurface,
  buildGalleryToolbarActions,
  GALLERY_HEADER_LAYOUT
} from './galleryToolbarModel'

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
  onClose,
  onDownload,
  onZoomIn,
  onZoomReset,
  onReply
}: Props) {
  const isMobile = Boolean(useStore((state) => state.settings.editor.isMobile))
  const layout = isMobile ? GALLERY_HEADER_LAYOUT.mobile : GALLERY_HEADER_LAYOUT.desktop
  const controlsHideClass = twMerge(
    'motion-safe:transition-opacity',
    !controlsVisible && 'pointer-events-none opacity-0'
  )
  const panelShell =
    'rounded-box border border-[var(--gallery-panel-border)] bg-[var(--gallery-panel-bg)] text-[var(--gallery-text-primary)] shadow-xl backdrop-blur-md'

  const actions = buildGalleryToolbarActions({
    isMobile,
    media,
    slideZoomed,
    canReply: Boolean(originMessage),
    downloading,
    onDownload,
    onZoomIn,
    onZoomReset,
    onReply
  })
  const pillActions = actionsOnSurface(actions, 'pill')
  const overflowPrefix = actionsOnSurface(actions, 'overflowPrefix')
  const overflowActions = actionsOnSurface(actions, 'overflow')

  const bandStyle = {
    ...controlsMotionStyle,
    '--gallery-counter-top': layout.counterTop
  } as CSSProperties & { '--gallery-counter-top': string }

  return (
    <>
      <div
        className={twMerge(
          'pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-between pt-[max(0.75rem,env(safe-area-inset-top))]',
          layout.headerClassName,
          controlsHideClass
        )}
        style={bandStyle}>
        {source?.authorName ? (
          <div
            className={twMerge(
              'flex min-w-0 items-center gap-2.5',
              layout.authorClassName,
              controlsVisible && 'pointer-events-auto'
            )}>
            <Avatar
              size="sm"
              edge="none"
              face={{
                id: source.authorUserId ?? undefined,
                avatarUrl: source.authorAvatarUrl,
                avatarUpdatedAt: source.authorAvatarUpdatedAt,
                display_name: source.authorName
              }}
              alt={source.authorName}
              clickable={false}
              className="shrink-0 bg-transparent"
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
            'flex shrink-0 items-center',
            layout.actionsGapClassName,
            controlsVisible && 'pointer-events-auto'
          )}>
          <div
            role="toolbar"
            aria-label="Media actions"
            className={twMerge(panelShell, 'flex items-center gap-0.5', layout.pillPadClassName)}>
            {pillActions.map((action) => (
              <GalleryPillAction
                key={action.id}
                isMobile={isMobile}
                aria-label={action.label}
                disabled={action.disabled}
                onClick={() => void action.onSelect()}>
                <action.Icon size={18} />
              </GalleryPillAction>
            ))}

            <GalleryOverflowMenu
              media={media}
              isMobile={isMobile}
              overflowPrefix={overflowPrefix}
              overflowActions={overflowActions}
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
            'pointer-events-none absolute inset-x-0 top-[var(--gallery-counter-top)] z-30 flex justify-center',
            controlsHideClass
          )}
          style={bandStyle}>
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
