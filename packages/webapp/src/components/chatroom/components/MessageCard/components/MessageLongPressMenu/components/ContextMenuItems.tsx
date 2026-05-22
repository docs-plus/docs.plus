import { MessageActionMenuList } from '@components/chatroom/components/MessageCard/components/MessageActionMenuList'
import { TMsgRow } from '@types'

import { useMessageLongPressMenu } from '../MessageLongPressMenu'

type Props = {
  message?: TMsgRow | null
  isInteractive?: boolean
}

export const LongPressMenuItems = ({ message, isInteractive = true }: Props) => {
  const { hideMenu } = useMessageLongPressMenu()
  if (!message) return null

  return (
    <MessageActionMenuList
      message={message}
      surface="longPress"
      onClose={hideMenu}
      isInteractive={isInteractive}
    />
  )
}
