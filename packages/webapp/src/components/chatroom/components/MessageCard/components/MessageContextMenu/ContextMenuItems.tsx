import { useMessageActionMenuItems } from '@components/chatroom/components/MessageCard/hooks/useMessageActionMenuItems'
import { useContextMenuContext } from '@components/ui/ContextMenu'
import { TMsgRow } from '@types'
import React from 'react'

import { MenuItem } from '../../../../../ui/ContextMenu'

type Props = {
  message?: TMsgRow | null
}

const ContextMenuItemsLoaded = ({ message }: { message: TMsgRow }) => {
  const { setIsOpen } = useContextMenuContext()
  const items = useMessageActionMenuItems(message, { iconSize: 18, includeReaction: true })

  return (
    <>
      {items.map(
        (item) =>
          item.display && (
            <MenuItem
              key={item.title}
              onClick={(e: React.MouseEvent) => {
                item.onClickFn(e)
                setIsOpen(false)
              }}
              className={item.className}>
              <a href="#">
                {item.icon}
                {item.title}
              </a>
            </MenuItem>
          )
      )}
    </>
  )
}

const ContextMenuItems = ({ message }: Props) => {
  if (!message) return null
  return <ContextMenuItemsLoaded message={message} />
}

export default ContextMenuItems
