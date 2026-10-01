import { type MessageActionMenuItem } from '@components/chatroom/components/MessageCard/hooks/messageActionMenu'
import { useMessageActionMenuItems } from '@components/chatroom/components/MessageCard/hooks/useMessageActionMenuItems'
import { ContextMenuDivider, ContextMenuRow, MenuItem } from '@components/ui/ContextMenu'
import { useCloseAfterHold } from '@hooks/useCloseAfterHold'
import { Icons } from '@icons'
import { TMsgRow } from '@types'
import { twMerge } from '@utils/twMerge'
import { motion } from 'motion/react'
import { Fragment, type MouseEvent } from 'react'

type Surface = 'contextMenu' | 'longPress'

type Props = {
  message: TMsgRow
  surface: Surface
  onClose: () => void
  iconSize?: number
  includeReaction?: boolean
  isInteractive?: boolean
}

function ActionMenuRow({
  item,
  copied,
  iconSize,
  disabled = false
}: {
  item: MessageActionMenuItem
  copied: boolean
  iconSize: number
  disabled?: boolean
}) {
  const isCopyLink = item.id === 'copy-link'
  const icon = isCopyLink ? (
    <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
      <Icons.check size={iconSize} className="swap-on text-success" />
      <span className="swap-off inline-flex">{item.icon}</span>
    </span>
  ) : (
    item.icon
  )
  const title = isCopyLink ? (
    <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
      <span className="swap-on">Copied!</span>
      <span className="swap-off">{item.title}</span>
    </span>
  ) : (
    item.title
  )

  return (
    <ContextMenuRow
      icon={icon}
      variant={item.variant}
      disabled={disabled}
      className={twMerge(item.className, isCopyLink && copied && 'text-success')}>
      {title}
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
  const { items, linkCopied } = useMessageActionMenuItems(message, { iconSize, includeReaction })
  const { schedule, cancel } = useCloseAfterHold(onClose)

  const activate = (item: MessageActionMenuItem, e?: MouseEvent) => {
    const result = item.onClickFn(e)
    if (item.id === 'copy-link') {
      void Promise.resolve(result).then((ok) => {
        if (ok) schedule()
      })
      return
    }
    cancel()
    onClose()
  }

  return (
    <>
      {items
        .filter((item) => item.display)
        .map((item) => (
          <Fragment key={item.id}>
            {item.separatorBefore && <ContextMenuDivider />}
            {surface === 'contextMenu' ? (
              <MenuItem
                aria-label={item.id === 'copy-link' && linkCopied ? 'Copied!' : item.title}
                onClick={(e) => activate(item, e)}>
                <ActionMenuRow item={item} copied={linkCopied} iconSize={iconSize} />
              </MenuItem>
            ) : (
              <motion.li
                aria-label={item.id === 'copy-link' && linkCopied ? 'Copied!' : item.title}
                onTap={() => {
                  if (!isInteractive) return
                  activate(item)
                }}
                whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
                className={twMerge(
                  'group rounded-field cursor-pointer touch-manipulation select-none',
                  !isInteractive && 'pointer-events-none'
                )}>
                <ActionMenuRow
                  item={item}
                  copied={linkCopied}
                  iconSize={iconSize}
                  disabled={!isInteractive}
                />
              </motion.li>
            )}
          </Fragment>
        ))}
    </>
  )
}
