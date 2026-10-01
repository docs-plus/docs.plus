import { useMessageComposer } from '../../hooks/useMessageComposer'
import CommentContext from './CommentContext'
import { QuotedMessageContext } from './QuotedMessageContext'

/** One bar at a time — matches submit priority in useComposerSubmit. */
export function ComposerContextBars() {
  const { editMessageMemory, commentMessageMemory, replyMessageMemory } = useMessageComposer()
  if (editMessageMemory) return <QuotedMessageContext kind="edit" />
  if (commentMessageMemory) return <CommentContext />
  if (replyMessageMemory) return <QuotedMessageContext kind="reply" />
  return null
}
