import { useMessageActionMenuItems } from '@components/chatroom/components/MessageCard/hooks/useMessageActionMenuItems'
import { TMsgRow } from '@types'
import { motion } from 'motion/react'

import { useMessageLongPressMenu } from '../MessageLongPressMenu'

type Props = {
  message?: TMsgRow | null
  isInteractive?: boolean
}

const LongPressMenuItemsLoaded = ({
  message,
  isInteractive
}: {
  message: TMsgRow
  isInteractive: boolean
}) => {
  const { hideMenu } = useMessageLongPressMenu()
  const items = useMessageActionMenuItems(message, { iconSize: 20 })

  return (
    <>
      {items.map(
        (item) =>
          item.display && (
            <motion.li
              key={item.title}
              onTap={() => {
                if (!isInteractive) return
                item.onClickFn()
                hideMenu()
              }}
              whileTap={{
                scale: 0.98,
                backgroundColor: 'color-mix(in oklch, var(--color-base-content) 10%, transparent)',
                transition: { duration: 0.1 }
              }}
              className={`${item.className} ${!isInteractive ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer select-none'} flex touch-manipulation items-center`}>
              <div className="flex w-full items-center gap-3">
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="font-medium">{item.title}</span>
              </div>
            </motion.li>
          )
      )}
    </>
  )
}

export const LongPressMenuItems = ({ message, isInteractive = true }: Props) => {
  if (!message) return null
  return <LongPressMenuItemsLoaded message={message} isInteractive={isInteractive} />
}
