import { TGroupedMsgRow } from '@types'
import { memo } from 'react'

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

// Memoized so parent re-renders (e.g. realtime UPDATE flipping
// MessageListProvider's value identity) don't cascade across every
// virtualized row. Children read via MessageCardContext, so their
// identity is intentionally excluded from the comparator.
const MessageCardComponent = ({ children, index, message, className }: Props) => {
  return (
    <MessageCardProvider message={message} index={index} className={className}>
      {children}
    </MessageCardProvider>
  )
}

export const MessageCard = memo(
  MessageCardComponent,
  (a, b) => a.index === b.index && a.message === b.message
) as unknown as typeof MessageCardComponent & {
  Actions: typeof MessageActions
  Header: typeof MessageHeader
  Content: typeof MessageContent
  Footer: typeof MessageFooter
  LongPressMenu: typeof MessageLongPressMenu
  FailedRow: typeof MessageFailedRow
}

MessageCard.Actions = MessageActions
MessageCard.Header = MessageHeader
MessageCard.Content = MessageContent
MessageCard.Footer = MessageFooter
MessageCard.LongPressMenu = MessageLongPressMenu
MessageCard.FailedRow = MessageFailedRow
