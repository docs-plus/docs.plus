import { CommentPreviewVisual } from '@components/CommentPreviewVisual'
import { getCommentAnchorExcerpt, getCommentAnchorLabel } from '@services/commentAnchor'
import type { CommentAnchorV1 } from '@types'

type Props = {
  anchor: CommentAnchorV1
  variant?: 'composer' | 'feed'
  /** When false, type label is omitted (feed header already names the target). */
  showTypeLabel?: boolean
}

export function CommentAnchorPreview({ anchor, variant = 'feed', showTypeLabel = true }: Props) {
  const layout = variant === 'feed' ? 'stacked-feed' : 'stacked-composer'
  const label = getCommentAnchorLabel(anchor)
  const excerpt = getCommentAnchorExcerpt(anchor)

  if (anchor.kind === 'text') {
    return (
      <p
        className="text-base-content/80 m-0 text-sm break-words wrap-anywhere whitespace-pre-wrap"
        dir="auto">
        {excerpt}
      </p>
    )
  }

  const preview = anchor.preview

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
      {preview.kind === 'label' ? (
        <p className="text-base-content/80 m-0 text-sm">{preview.text}</p>
      ) : (
        <>
          <CommentPreviewVisual preview={preview} nodeType={anchor.node_type} layout={layout} />
          <div className="w-full min-w-0">
            {showTypeLabel ? (
              <p className="text-secondary m-0 text-xs font-semibold">{label}</p>
            ) : null}
            {excerpt && excerpt !== label ? (
              <p
                className="text-base-content/80 m-0 text-sm break-words wrap-anywhere whitespace-pre-wrap"
                dir="auto">
                {excerpt}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
