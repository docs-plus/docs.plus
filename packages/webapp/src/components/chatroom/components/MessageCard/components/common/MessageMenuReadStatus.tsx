import { ContextMenuDivider } from '@components/ui/ContextMenu'
import { TMsgRow } from '@types'

import { useIsMessageSeenByPeers, UserReadStatus } from './UserReadStatus'

type Props = {
  message: TMsgRow
  isOpen: boolean
  wrapper: 'li' | 'MenuItem'
  className?: string
  avatarLoaderRepeat?: number
}

export function MessageMenuReadStatus({ message, ...rest }: Props) {
  if (!useIsMessageSeenByPeers(message)) return null

  return (
    <>
      <ContextMenuDivider />
      <UserReadStatus message={message} {...rest} />
    </>
  )
}
