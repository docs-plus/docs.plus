import { CommentAnchorPreview } from '@components/chatroom/components/CommentAnchorPreview'
import { getCommentAnchorLabel, parseCommentAnchor } from '@services/commentAnchor'
import { getMetadataProperty } from '@utils/metadata'
import { scrollToHeading } from '@utils/scrollToHeading'

import { useMessageCardContext } from '../../../MessageCardContext'
import { ReferenceJumpButton } from './ReferenceJumpButton'

export const CommentReference = () => {
  const { message } = useMessageCardContext()

  const rawComment = getMetadataProperty(message.metadata, 'comment')
  if (message.type !== 'comment' && !rawComment) return null

  const anchor = parseCommentAnchor(rawComment)
  if (!anchor) return null

  return (
    <ReferenceJumpButton
      kind="comment"
      dataKey={`comment-ref-${anchor.heading_id}`}
      ariaLabel="Jump to commented section in document"
      widthClass="w-full"
      onJump={() => scrollToHeading(anchor.heading_id)}
      header={
        <>
          <span className="text-base-content/40 font-normal">·</span>
          <span className="text-base-content font-normal">{getCommentAnchorLabel(anchor)}</span>
        </>
      }>
      <CommentAnchorPreview anchor={anchor} variant="feed" showTypeLabel={false} />
    </ReferenceJumpButton>
  )
}
