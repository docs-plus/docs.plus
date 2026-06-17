import { useMediaUrlUnfurl } from '@components/TipTap/mediaPopovers/useMediaUrlUnfurl'
import { Icons } from '@icons'
import type { CommentPreview } from '@types'

const hideOnError = (e: { currentTarget: HTMLElement }) => {
  e.currentTarget.style.display = 'none'
}

export type CommentPreviewLayout = 'insert-inline' | 'stacked-feed' | 'stacked-composer'

type LayoutTokens = {
  stacked: boolean
  compact: boolean
  feedThumb: string
  composerThumb: string
  insertMediaClass: string
  inlineWrapperClass: string
  stackedWrapperClass: string
  skeletonMaxH: string
}

const BASE_LAYOUT = {
  feedThumb: 'max-h-24 w-full max-w-[10rem] rounded object-cover',
  composerThumb: 'max-h-32 w-full max-w-xs rounded object-cover',
  insertMediaClass: 'mx-auto max-h-48 w-auto object-contain',
  inlineWrapperClass: 'relative overflow-hidden',
  stackedWrapperClass: 'relative w-full max-w-[10rem] shrink-0 overflow-hidden rounded'
} satisfies Omit<LayoutTokens, 'stacked' | 'compact' | 'skeletonMaxH'>

const LAYOUT: Record<CommentPreviewLayout, LayoutTokens> = {
  'insert-inline': { ...BASE_LAYOUT, stacked: false, compact: false, skeletonMaxH: 'max-h-32' },
  'stacked-feed': { ...BASE_LAYOUT, stacked: true, compact: true, skeletonMaxH: 'max-h-24' },
  'stacked-composer': { ...BASE_LAYOUT, stacked: true, compact: false, skeletonMaxH: 'max-h-32' }
}

function MediaTypeIcon({ nodeType }: { nodeType: string }) {
  if (nodeType === 'video') return <Icons.video size={18} className="shrink-0" />
  if (nodeType === 'audio') return <Icons.music size={18} className="shrink-0" />
  return <Icons.image size={18} className="shrink-0" />
}

function UnfurlPreview({ src, layout }: { src: string; layout: CommentPreviewLayout }) {
  const tokens = LAYOUT[layout]
  const unfurl = useMediaUrlUnfurl(src, true)
  const thumbClass =
    layout === 'insert-inline' ? 'size-16 shrink-0 rounded object-cover' : tokens.feedThumb

  if (unfurl.status === 'loading') {
    if (layout === 'insert-inline') {
      return (
        <div className="flex gap-3">
          <div className="skeleton size-16 shrink-0 rounded" />
          <div className="flex flex-1 flex-col justify-center gap-2">
            <div className="skeleton h-3.5 w-3/4" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
      )
    }
    return (
      <div className="flex w-full max-w-[10rem] flex-col gap-1.5">
        <div className={`skeleton aspect-video w-full rounded ${tokens.skeletonMaxH}`} />
        <div className="skeleton h-3 w-3/4" />
        <div className="skeleton h-2.5 w-1/2" />
      </div>
    )
  }

  if (unfurl.status === 'loaded' && unfurl.data) {
    const { thumbnail, title, hostname } = unfurl.data
    if (layout === 'insert-inline') {
      return (
        <div className="flex items-center gap-3">
          {thumbnail ? (
            <img src={thumbnail} alt="" className={thumbClass} onError={hideOnError} />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-base-content truncate text-sm font-medium">{title}</p>
            <p className="text-base-content/50 truncate text-xs">{hostname}</p>
          </div>
        </div>
      )
    }
    return (
      <div className="flex w-full max-w-[10rem] flex-col gap-1">
        {thumbnail ? (
          <img src={thumbnail} alt="" className={thumbClass} onError={hideOnError} />
        ) : (
          <span className="bg-base-300 flex aspect-video max-h-24 w-full max-w-[10rem] items-center justify-center rounded">
            <Icons.image size={20} />
          </span>
        )}
        <p className="m-0 truncate text-sm font-medium">{title}</p>
        <p className="text-base-content/50 m-0 truncate text-xs">{hostname}</p>
      </div>
    )
  }

  return null
}

type Props = {
  preview: CommentPreview
  nodeType?: string
  layout: CommentPreviewLayout
}

export function CommentPreviewVisual({ preview, nodeType, layout }: Props) {
  const tokens = LAYOUT[layout]
  const thumbClass = tokens.compact ? tokens.feedThumb : tokens.composerThumb

  if (preview.kind === 'img') {
    const imgClass = layout === 'insert-inline' ? tokens.insertMediaClass : thumbClass
    const img = (
      <img key={preview.src} src={preview.src} alt="" className={imgClass} onError={hideOnError} />
    )
    const badge = preview.badge ? (
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="bg-base-100/80 flex size-10 items-center justify-center rounded-full shadow">
          <Icons.play className="text-base-content ml-0.5" size={14} aria-hidden />
        </span>
      </span>
    ) : null

    return (
      <div
        className={
          layout === 'insert-inline' ? tokens.inlineWrapperClass : tokens.stackedWrapperClass
        }>
        {img}
        {badge}
      </div>
    )
  }

  if (preview.kind === 'video' || preview.kind === 'audio') {
    if (layout === 'insert-inline') {
      if (preview.kind === 'video') {
        return (
          <video
            key={preview.src}
            src={preview.src}
            controls
            preload="metadata"
            className={tokens.insertMediaClass}
            onError={hideOnError}
          />
        )
      }
      return (
        <audio
          key={preview.src}
          src={preview.src}
          controls
          preload="metadata"
          className="w-full p-2"
          onError={hideOnError}
        />
      )
    }
    if (tokens.compact) {
      return (
        <span className="bg-base-300 flex aspect-video max-h-24 w-full max-w-[10rem] items-center justify-center rounded">
          {preview.kind === 'video' ? <Icons.video size={24} /> : <Icons.music size={24} />}
        </span>
      )
    }
    return (
      <div className="rounded-box border-base-300 bg-base-200 w-full max-w-xs overflow-hidden border">
        {preview.kind === 'video' ? (
          <video
            src={preview.src}
            controls
            preload="metadata"
            className="max-h-32 w-full object-contain"
          />
        ) : (
          <audio src={preview.src} controls preload="metadata" className="w-full p-2" />
        )}
      </div>
    )
  }

  if (preview.kind === 'unfurl-src') {
    return <UnfurlPreview src={preview.src} layout={layout} />
  }

  if (preview.kind === 'unfurl') {
    return (
      <div className="flex w-full max-w-[10rem] flex-col gap-1">
        {preview.image ? (
          <img src={preview.image} alt="" className={thumbClass} onError={hideOnError} />
        ) : (
          <span className="bg-base-300 flex aspect-video max-h-24 w-full items-center justify-center rounded">
            {nodeType ? <MediaTypeIcon nodeType={nodeType} /> : <Icons.image size={20} />}
          </span>
        )}
        {preview.title ? <p className="m-0 truncate text-sm font-medium">{preview.title}</p> : null}
        {preview.hostname ? (
          <p className="text-base-content/50 m-0 truncate text-xs">{preview.hostname}</p>
        ) : null}
      </div>
    )
  }

  if (tokens.stacked) {
    return (
      <span className="bg-base-300 flex aspect-video max-h-24 w-full max-w-[10rem] items-center justify-center rounded">
        {nodeType ? <MediaTypeIcon nodeType={nodeType} /> : <Icons.image size={24} />}
      </span>
    )
  }

  return null
}
