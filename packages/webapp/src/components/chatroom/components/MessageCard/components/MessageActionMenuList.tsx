import {
  type MessageActionMenuItem,
  useMessageActionMenuItems
} from '@components/chatroom/components/MessageCard/hooks/useMessageActionMenuItems'
import { ContextMenuDivider, ContextMenuRow, MenuItem } from '@components/ui/ContextMenu'
import { TMsgRow } from '@types'
import { motion } from 'motion/react'
import { Fragment } from 'react'
import { twMerge } from 'tailwind-merge'

type Surface = 'contextMenu' | 'longPress'

type Props = {
  message: TMsgRow
  surface: Surface
  onClose: () => void
  iconSize?: number
  includeReaction?: boolean
  isInteractive?: boolean
}

function ActionMenuRow({ item }: { item: MessageActionMenuItem }) {
  return (
    <ContextMenuRow icon={item.icon} variant={item.variant} className={item.className}>
      {item.title}
    </ContextMenuRow>
  )
}

export function MessageActionMenuList({
  message,
  surface,
  onClose,
  iconSize = surface === 'longPress' ? 20 : 16,
  includeReaction = surface === 'contextMenu',
  isInteractive = true
}: Props) {
  const items = useMessageActionMenuItems(message, { iconSize, includeReaction })

  return (
    <>
      {items
        .filter((item) => item.display)
        .map((item) => (
          <Fragment key={item.title}>
            {item.separatorBefore && <ContextMenuDivider />}
            {surface === 'contextMenu' ? (
              <MenuItem
                onClick={(e) => {
                  item.onClickFn(e)
                  onClose()
                }}>
                <ActionMenuRow item={item} />
              </MenuItem>
            ) : (
              <motion.li
                onTap={() => {
                  if (!isInteractive) return
                  item.onClickFn()
                  onClose()
                }}
                whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
                className={twMerge(
                  'group cursor-pointer touch-manipulation rounded-lg select-none',
                  !isInteractive && 'pointer-events-none cursor-not-allowed opacity-60'
                )}>
                <ActionMenuRow item={item} />
              </motion.li>
            )}
          </Fragment>
        ))}
    </>
  )
}
