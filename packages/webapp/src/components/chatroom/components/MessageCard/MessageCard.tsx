import { TGroupedMsgRow } from '@types'

import MessageActions from './components/MessageActions'
import MessageContent from './components/MessageContent'
import { MessageFailedRow } from './components/MessageFailedRow'
import MessageFooter from './components/MessageFooter/MessageFooter'
import MessageHeader from './components/MessageHeader'
import { MessageLongPressMenu } from './components/MessageLongPressMenu'
import { MessageCardProvider } from './MessageCardContext'

type Props = {
  children: React.ReactNode
  index: number
  message: TGroupedMsgRow
  className?: string
}
export const MessageCard = ({ children, index, message, className }: Props) => {
  return (
    <MessageCardProvider message={message} index={index} className={className}>
      {children}
    </MessageCardProvider>
  )
}

MessageCard.Actions = MessageActions
MessageCard.Header = MessageHeader
MessageCard.Content = MessageContent
MessageCard.Footer = MessageFooter
MessageCard.LongPressMenu = MessageLongPressMenu
MessageCard.FailedRow = MessageFailedRow
