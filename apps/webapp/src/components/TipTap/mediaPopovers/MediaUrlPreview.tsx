import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import { FaPlay } from 'react-icons/fa6'

import { MEDIA_INSERT_REGISTRY } from './mediaInsert'
import { useMediaUrlUnfurl } from './useMediaUrlUnfurl'

interface MediaUrlPreviewProps {
  detectedType: MediaNodeType | null
  value: string
}

/** Hide a preview element whose source fails to load (invalid/unreachable URL). */
const hideOnError = (e: { currentTarget: HTMLElement }) => {
  e.currentTarget.style.display = 'none'
}

/**
 * Inline field preview: a static element for image/youtube/video/audio, or a
 * metadata unfurl card (thumbnail + title) for vimeo/soundcloud/loom. Renders
 * nothing for types with no preview (e.g. X) — the "Detected" chip stands alone.
 */
export default function MediaUrlPreview({ detectedType, value }: MediaUrlPreviewProps) {
  const entry = detectedType ? MEDIA_INSERT_REGISTRY[detectedType] : null
  const preview = entry?.preview?.(value) ?? null
  const unfurl = useMediaUrlUnfurl(value, entry?.unfurl ?? false)

  if (preview) {
    return (
      // key={preview.src} resets a prior onError display:none when the URL changes.
      <div className="rounded-box border-base-300 bg-base-200 relative mt-1 overflow-hidden border">
        {preview.kind === 'img' && (
          <img
            key={preview.src}
            src={preview.src}
            alt="Preview"
            className="mx-auto max-h-48 w-auto object-contain"
            onError={hideOnError}
          />
        )}
        {preview.kind === 'video' && (
          <video
            key={preview.src}
            src={preview.src}
            controls
            preload="metadata"
            className="mx-auto max-h-48 w-auto object-contain"
            onError={hideOnError}
          />
        )}
        {preview.kind === 'audio' && (
          <audio
            key={preview.src}
            src={preview.src}
            controls
            preload="metadata"
            className="w-full p-2"
            onError={hideOnError}
          />
        )}
        {preview.badge && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="bg-base-100/80 flex size-12 items-center justify-center rounded-full shadow">
              <FaPlay className="text-base-content ml-0.5" size={18} />
            </span>
          </span>
        )}
      </div>
    )
  }

  if (unfurl.status === 'loading') {
    return (
      <div className="rounded-box border-base-300 bg-base-200 mt-1 flex gap-3 border p-2">
        <div className="skeleton size-16 shrink-0 rounded" />
        <div className="flex flex-1 flex-col justify-center gap-2">
          <div className="skeleton h-3.5 w-3/4" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
    )
  }

  if (unfurl.status === 'loaded' && unfurl.data) {
    const { thumbnail, title, hostname } = unfurl.data
    return (
      <div className="rounded-box border-base-300 bg-base-200 mt-1 flex items-center gap-3 border p-2">
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            className="size-16 shrink-0 rounded object-cover"
            onError={hideOnError}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base-content truncate text-sm font-medium">{title}</p>
          <p className="text-base-content/50 truncate text-xs">{hostname}</p>
        </div>
      </div>
    )
  }

  return null
}
