import { CommentAnchorPreview } from '@components/chatroom/components/CommentAnchorPreview'
import { getCommentAnchorLabel, parseCommentAnchor } from '@services/commentAnchor'
import { commentReferenceTheme } from '@utils/commentReferenceTheme'
import { getMetadataProperty } from '@utils/metadata'
import { scrollToCommentAnchor } from '@utils/scrollToCommentAnchor'

import { useMessageCardContext } from '../../../MessageCardContext'
import { ReferenceJumpButton } from './ReferenceJumpButton'

export const CommentReference = () => {
  const { message } = useMessageCardContext()

  const rawComment = getMetadataProperty(message.metadata, 'comment')
  if (message.type !== 'comment' && !rawComment) return null

  const anchor = parseCommentAnchor(rawComment)
  if (!anchor) return null

  const theme = commentReferenceTheme(anchor)
  const typeLabel = getCommentAnchorLabel(anchor)

  return (
    <ReferenceJumpButton
      kind="comment"
      commentTheme={theme}
      dataKey={`comment-ref-${anchor.heading_id}`}
      ariaLabel="Jump to commented content in document"
      onJump={() => scrollToCommentAnchor(anchor)}
      header={
        <>
          <span className="text-base-content/50 font-normal" aria-hidden>
            ·
          </span>
          <span className="text-base-content font-normal">{typeLabel}</span>
        </>
      }>
      <CommentAnchorPreview anchor={anchor} variant="feed" showTypeLabel={false} />
    </ReferenceJumpButton>
  )
}
