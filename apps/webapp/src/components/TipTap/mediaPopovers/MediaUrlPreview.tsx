import { CommentPreviewVisual } from '@components/CommentPreviewVisual'
import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'

import { commentPreviewFromStaticMedia } from './buildCommentPreview'
import { MEDIA_INSERT_REGISTRY } from './mediaInsert'
import { useMediaUrlUnfurl } from './useMediaUrlUnfurl'

interface MediaUrlPreviewProps {
  detectedType: MediaNodeType | null
  value: string
}

/**
 * Inline field preview: static element for image/youtube/video/audio, or metadata
 * unfurl for vimeo/soundcloud/loom/spotify. Nothing for types with no preview (e.g. X).
 */
export default function MediaUrlPreview({ detectedType, value }: MediaUrlPreviewProps) {
  const entry = detectedType ? MEDIA_INSERT_REGISTRY[detectedType] : null
  const preview = entry?.preview?.(value) ?? null
  const unfurl = useMediaUrlUnfurl(value, entry?.unfurl ?? false)

  if (preview) {
    return (
      <div className="rounded-box border-base-300 bg-base-200 relative mt-1 overflow-hidden border">
        <CommentPreviewVisual
          preview={commentPreviewFromStaticMedia(preview)}
          layout="insert-inline"
        />
      </div>
    )
  }

  if (unfurl.status === 'loading' || (unfurl.status === 'loaded' && unfurl.data)) {
    return (
      <div className="rounded-box border-base-300 bg-base-200 mt-1 border p-2">
        <CommentPreviewVisual preview={{ kind: 'unfurl-src', src: value }} layout="insert-inline" />
      </div>
    )
  }

  return null
}
