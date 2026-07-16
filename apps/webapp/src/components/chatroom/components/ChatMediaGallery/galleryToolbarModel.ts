import { readGalleryActiveMediaUrl } from '@components/chatroom/stores/chatMediaGalleryStore'
import {
  copyMediaImage,
  copyResolvedMediaLink,
  openResolvedMediaLink
} from '@components/chatroom/utils/galleryMediaActions'
import type { GalleryMediaItem } from '@components/chatroom/utils/galleryPlaylist'
import { Icons } from '@icons'
import type { IconType } from 'react-icons'

export type GalleryToolbarSurface = 'pill' | 'overflowPrefix' | 'overflow'

export type GalleryToolbarAction = {
  id: string
  label: string
  Icon: IconType
  onSelect: () => void | Promise<unknown>
  disabled?: boolean
  surfaces: GalleryToolbarSurface[]
}

export type GalleryHeaderLayout = {
  headerClassName: string
  authorClassName: string
  actionsGapClassName: string
  pillPadClassName: string
  /** Absolute `top` for the multi-item counter — clears the header band + safe area. */
  counterTop: string
}

export const GALLERY_HEADER_LAYOUT = {
  mobile: {
    headerClassName: 'items-center gap-3 px-3 pb-2',
    authorClassName: 'flex-1',
    actionsGapClassName: 'gap-1.5',
    pillPadClassName: 'px-0.5 py-0.5',
    counterTop: 'max(5.25rem, calc(env(safe-area-inset-top) + 4.25rem))'
  },
  desktop: {
    headerClassName: 'items-start gap-6 px-4 pb-3',
    authorClassName: 'max-w-[min(52vw,22rem)] items-start',
    actionsGapClassName: 'gap-2',
    pillPadClassName: 'px-1 py-1',
    counterTop: 'max(3.75rem, env(safe-area-inset-top))'
  }
} as const satisfies Record<'mobile' | 'desktop', GalleryHeaderLayout>

type BuildArgs = {
  isMobile: boolean
  media: GalleryMediaItem
  slideZoomed: boolean
  canReply: boolean
  downloading: boolean
  onDownload: () => void
  onZoomIn: () => void
  onZoomReset: () => void
  onReply: () => void
}

/** One action list; pill vs overflow placement is data, not parallel JSX. */
export function buildGalleryToolbarActions({
  isMobile,
  media,
  slideZoomed,
  canReply,
  downloading,
  onDownload,
  onZoomIn,
  onZoomReset,
  onReply
}: BuildArgs): GalleryToolbarAction[] {
  const isImage = media.type === 'image'
  const primarySurfaces: GalleryToolbarSurface[] = isMobile ? ['overflowPrefix'] : ['pill']

  const actions: GalleryToolbarAction[] = []

  if (isImage) {
    actions.push({
      id: 'zoom',
      label: slideZoomed ? 'Fit image to screen' : 'Zoom in',
      Icon: slideZoomed ? Icons.zoomOut : Icons.zoomIn,
      onSelect: () => (slideZoomed ? onZoomReset() : onZoomIn()),
      surfaces: primarySurfaces
    })
  }

  if (canReply) {
    actions.push({
      id: 'reply',
      label: 'Reply',
      Icon: Icons.reply,
      onSelect: onReply,
      surfaces: primarySurfaces
    })
  }

  actions.push({
    id: 'download',
    label: 'Download media',
    Icon: Icons.download,
    onSelect: onDownload,
    disabled: downloading,
    surfaces: ['pill']
  })

  actions.push({
    id: 'open',
    label: 'Open in browser',
    Icon: Icons.externalLink,
    onSelect: () => {
      openResolvedMediaLink(readGalleryActiveMediaUrl())
    },
    surfaces: primarySurfaces
  })

  if (isImage) {
    actions.push({
      id: 'copy-image',
      label: 'Copy Image',
      Icon: Icons.copy,
      onSelect: () => copyMediaImage(media, readGalleryActiveMediaUrl()),
      surfaces: ['overflow']
    })
  }

  actions.push({
    id: 'copy-link',
    label: 'Copy Media Link',
    Icon: Icons.link,
    onSelect: () => copyResolvedMediaLink(readGalleryActiveMediaUrl()),
    surfaces: ['overflow']
  })

  return actions
}

export function actionsOnSurface(
  actions: GalleryToolbarAction[],
  surface: GalleryToolbarSurface
): GalleryToolbarAction[] {
  return actions.filter((action) => action.surfaces.includes(surface))
}
