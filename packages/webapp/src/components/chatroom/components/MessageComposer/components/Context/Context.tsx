import { twMerge } from 'tailwind-merge'
import CommentContext from './CommentContext'
import EditContext from './EditContext'
import ReplyContext from './ReplyContext'
import { useMessageComposer } from '../../hooks/indext'
import { useHandleEscKey } from '../../hooks/useHandleEscKey'

interface TContextProps {
  type?: 'reply' | 'edit' | 'comment'
  onDismiss?: () => void
  children?: React.ReactNode
  className?: string
}

export const Context = ({ type, className = '', children }: TContextProps) => {
  const { contextType } = useMessageComposer()
  // close context when esc key is pressed
  useHandleEscKey()

  const renderContextContent = (type: 'reply' | 'edit' | 'comment' | null) => {
    switch (type) {
      case 'reply':
        return <ReplyContext />
      case 'edit':
        return <EditContext />
      case 'comment':
        return <CommentContext />
    }
  }

  return (
    <div className={twMerge('message-context', className)}>
      {type ? renderContextContent(type || contextType) : children}
    </div>
  )
}

Context.displayName = 'Context'

Context.ReplyContext = ReplyContext
Context.EditContext = EditContext
Context.CommentContext = CommentContext
