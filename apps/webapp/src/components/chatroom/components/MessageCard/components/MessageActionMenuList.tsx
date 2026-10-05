import {
  MESSAGE_MENU_ICON_SIZE,
  type MessageActionMenuItem,
  type MessageActionMenuItemId
} from '@components/chatroom/components/MessageCard/hooks/messageActionMenu'
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
  includeReaction?: boolean
  isInteractive?: boolean
  /** Shows only these rows, in this order. */
  only?: MessageActionMenuItemId[]
}

function ActionMenuRow({
  item,
  copied,
  className
}: {
  item: MessageActionMenuItem
  copied: boolean
  className?: string
}) {
  const isCopyLink = item.id === 'copy-link'
  const icon = isCopyLink ? (
    <span className={twMerge('swap', copied && 'swap-active')} aria-hidden>
      <Icons.check size={MESSAGE_MENU_ICON_SIZE} className="swap-on text-success" />
      <span className="swap-off inline-flex">{item.icon}</span>
    </span>
  ) : (
    item.icon
  )
  const title = isCopyLink ? (
    <span className={twMerge('swap align-top', copied && 'swap-active')} aria-hidden>
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
      className={twMerge(
        item.className,
        isCopyLink && copied && 'text-[var(--success-ink)]',
        className
      )}>
      {title}
    </ContextMenuRow>
  )
}

export function MessageActionMenuList({
  message,
  surface,
  onClose,
  includeReaction = surface === 'contextMenu',
  isInteractive = true,
  only
}: Props) {
  const { items, linkCopied } = useMessageActionMenuItems(message, { includeReaction })
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

  const rows = only
    ? only
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is MessageActionMenuItem => Boolean(item))
    : items

  return (
    <>
      {rows
        .filter((item) => item.display)
        .map((item) => (
          <Fragment key={item.id}>
            {item.separatorBefore && <ContextMenuDivider />}
            {surface === 'contextMenu' ? (
              <MenuItem
                aria-label={item.id === 'copy-link' && linkCopied ? 'Copied!' : item.title}
                onClick={(e) => activate(item, e)}>
                <ActionMenuRow item={item} copied={linkCopied} />
              </MenuItem>
            ) : (
              <motion.li
                role="menuitem"
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
                {/* Full ink while the press is held; the li ignores taps until it ends. */}
                <ActionMenuRow item={item} copied={linkCopied} className="min-h-11" />
              </motion.li>
            )}
          </Fragment>
        ))}
    </>
  )
}
