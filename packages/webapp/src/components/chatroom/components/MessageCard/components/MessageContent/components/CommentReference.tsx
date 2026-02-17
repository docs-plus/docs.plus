import { Icons } from '@icons'
import { getMetadataProperty } from '@utils/metadata'

import { useMessageCardContext } from '../../../MessageCardContext'

export const CommentReference = () => {
  const { message } = useMessageCardContext()

  const comment = getMetadataProperty<{ content?: string; html?: string }>(
    message.metadata,
    'comment'
  )
  const commentContent = comment?.content || ''

  if (!commentContent) return null

  return (
    <div className="bg-base-200 text-base-content border-info mb-1 w-full rounded border-l-4 p-1">
      <div className="flex items-center">
        <div className="mr-2">
          <Icons.comment size={20} />
        </div>
        <p className="m-0 text-sm" dir="auto">
          {commentContent}
        </p>
      </div>
    </div>
  )
}
