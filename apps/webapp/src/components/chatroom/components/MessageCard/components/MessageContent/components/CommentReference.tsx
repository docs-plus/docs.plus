import { Icons } from '@icons'
import type { TSendCommentArgs } from '@types'
import { getMetadataProperty } from '@utils/metadata'
import { scrollToHeading } from '@utils/scrollToHeading'
import { useCallback } from 'react'

import { useMessageCardContext } from '../../../MessageCardContext'
import { ReferenceJumpButton } from './ReferenceJumpButton'

type CommentMetadata = Pick<TSendCommentArgs['comment'], 'content' | 'html' | 'heading_id'>

export const CommentReference = () => {
  const { message } = useMessageCardContext()

  const comment = getMetadataProperty<CommentMetadata>(message.metadata, 'comment')
  const commentContent = comment?.content || ''
  // New sends store heading_id; legacy rows only have channel_id (= heading id in eventsHub).
  const headingId = comment?.heading_id ?? message.channel_id

  const onJump = useCallback(() => {
    scrollToHeading(headingId)
  }, [headingId])

  if (!commentContent) return null

  return (
    <ReferenceJumpButton
      dataKey={`comment-ref-${headingId}`}
      ariaLabel="Jump to commented heading"
      widthClass="w-full"
      onJump={onJump}>
      <div className="flex items-center">
        <div className="mr-2">
          <Icons.comment size={18} />
        </div>
        <p className="m-0 text-sm" dir="auto">
          {commentContent}
        </p>
      </div>
    </ReferenceJumpButton>
  )
}
