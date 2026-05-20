import { useMessageComposer } from '../../hooks/useMessageComposer'
import CommentContext from './CommentContext'
import EditContext from './EditContext'
import ReplyContext from './ReplyContext'

/** One bar at a time — matches submit priority in useComposerSubmit. */
export function ComposerContextBars() {
  const { editMessageMemory, commentMessageMemory, replyMessageMemory } = useMessageComposer()
  if (editMessageMemory) return <EditContext />
  if (commentMessageMemory) return <CommentContext />
  if (replyMessageMemory) return <ReplyContext />
  return null
}
