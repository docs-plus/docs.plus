import { MdInsertComment } from 'react-icons/md'
import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {}

export const CommentReference = ({}: Props) => {
  const { message } = useMessageCardContext()

  if (!message.metadata?.comment) return null

  return (
    <div className="bg-base-200 text-base-content mb-1 w-full rounded border-l-4 border-cyan-400 p-1">
      <div className="flex items-center">
        <div className="mr-2">
          <MdInsertComment size={20} />
        </div>
        <p className="m-0 text-sm" dir="auto">
          {message?.metadata?.comment?.content || ''}
        </p>
      </div>
    </div>
  )
}
