import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../../MessageCardContext'
import MessageIndicators from './components/MessageIndicators'
import MessageReactions from './components/MessageReactions'

type Props = {
  className?: string
  children?: React.ReactNode
}
const MessageFooter = ({ className, children }: Props) => {
  const { message } = useMessageCardContext()
  if (message.status === 'failed') return null
  return <div className={twMerge('message-footer', className)}>{children}</div>
}

export default MessageFooter

MessageFooter.Indicators = MessageIndicators
MessageFooter.Reactions = MessageReactions
