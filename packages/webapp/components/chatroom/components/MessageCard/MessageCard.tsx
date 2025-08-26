import { MessageCardProvider } from './MessageCardContext'
import { TMsgRow } from '@types'
import MessageActions from './components/MessageActions'
import MessageContent, { MessageBody, ReplyReference } from './components/MessageContent'
import MessageHeader, { BookmarkIndicator, Timestamp, Username } from './components/MessageHeader'
import MessageFooter from './components/MessageFooter/MessageFooter'

type Props = {
  children: React.ReactNode
  index: number
  message: TMsgRow
  className?: string
}
export const MessageCard = ({ children, index, message, className }: Props) => {
  // console.log('MessageCard MessageCard MessageCard', { message, index })
  return (
    <MessageCardProvider message={message} index={index} className={className}>
      {children}
    </MessageCardProvider>
  )
}
// Actions
MessageCard.Actions = MessageActions

// Header
MessageCard.Header = MessageHeader

// Content
MessageCard.Content = MessageContent

// Footer
MessageCard.Footer = MessageFooter
