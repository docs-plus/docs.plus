import { CommentPreviewVisual } from '@components/CommentPreviewVisual'
import { getCommentAnchorExcerpt, getCommentAnchorLabel } from '@services/commentAnchor'
import type { CommentAnchorV1 } from '@types'
import type { CommentReferenceTheme } from '@utils/commentReferenceTheme'
import { twMerge } from 'tailwind-merge'

const EXCERPT_CLASS =
  'text-base-content/80 m-0 text-sm break-words wrap-anywhere whitespace-pre-wrap'

type Props = {
  anchor: CommentAnchorV1
  /** Used for media emphasis; text anchors ignore it. */
  theme: CommentReferenceTheme
  variant?: 'composer' | 'feed'
  /** When false, type label is omitted (feed header already names the target). */
  showTypeLabel?: boolean
}

export function CommentAnchorPreview({
  anchor,
  theme,
  variant = 'feed',
  showTypeLabel = true
}: Props) {
  const excerpt = getCommentAnchorExcerpt(anchor)

  if (anchor.kind === 'text') {
    return (
      <p className={EXCERPT_CLASS} dir="auto">
        {excerpt}
      </p>
    )
  }

  const preview = anchor.preview
  const typeLabel = getCommentAnchorLabel(anchor)
  const layout = variant === 'feed' ? 'stacked-feed' : 'stacked-composer'

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
      {preview.kind === 'label' ? (
        <p className="text-base-content/80 m-0 text-sm">{preview.text}</p>
      ) : (
        <>
          <CommentPreviewVisual preview={preview} nodeType={anchor.node_type} layout={layout} />
          <div className="w-full min-w-0">
            {showTypeLabel ? (
              <p className={twMerge('m-0 text-xs font-semibold', theme.emphasis)}>{typeLabel}</p>
            ) : null}
            {excerpt && excerpt !== typeLabel ? (
              <p className={EXCERPT_CLASS} dir="auto">
                {excerpt}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
