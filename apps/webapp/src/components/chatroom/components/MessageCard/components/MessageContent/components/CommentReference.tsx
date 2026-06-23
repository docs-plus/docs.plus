import { CommentAnchorPreview } from '@components/chatroom/components/CommentAnchorPreview'
import { getCommentAnchorLabel, parseCommentAnchor } from '@services/commentAnchor'
import { commentReferenceTheme } from '@utils/commentReferenceTheme'
import { getMetadataProperty } from '@utils/metadata'
import { scrollToHeading } from '@utils/scrollToHeading'
import { twMerge } from 'tailwind-merge'

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
      ariaLabel="Jump to commented section in document"
      onJump={() => scrollToHeading(anchor.heading_id)}
      header={
        <>
          <span className="text-base-content/40 font-normal">·</span>
          <span className={twMerge('font-normal', theme.emphasis)}>{typeLabel}</span>
        </>
      }>
      <CommentAnchorPreview anchor={anchor} theme={theme} variant="feed" showTypeLabel={false} />
    </ReferenceJumpButton>
  )
}
