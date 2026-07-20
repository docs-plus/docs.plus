import {
  ContextMenuDivider,
  ContextMenuRow,
  MenuItem,
  useContextMenuContext
} from '@components/ui/ContextMenu'
import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'

import { tocActions } from './hooks'

interface TocContextMenuProps {
  headingId: string | null
  isOpen: boolean
  onToggle: (id: string) => void
}

export function TocContextMenu({ headingId, isOpen, onToggle }: TocContextMenuProps) {
  const { setIsOpen } = useContextMenuContext()

  if (!headingId) return null

  const menuItems = [
    {
      title: 'Chat Room',
      icon: <Icons.chatroom size={16} />,
      onClick: () => tocActions.openChatroom(headingId, { scrollTo: true }),
      variant: 'primary' as const
    },
    {
      title: isOpen ? 'Fold Section' : 'Unfold Section',
      icon: isOpen ? <Icons.foldVertical size={16} /> : <Icons.unfoldVertical size={16} />,
      onClick: () => onToggle(headingId)
    },
    {
      title: 'Focus Section',
      icon: <Icons.crosshair size={16} />,
      onClick: () => tocActions.focusSection(headingId)
    },
    {
      title: 'Copy link',
      icon: <Icons.link size={16} />,
      onClick: () => void tocActions.copyLink(headingId)
    }
  ]

  return (
    <>
      {menuItems.map((item) => (
        <MenuItem
          key={item.title}
          onClick={() => {
            item.onClick()
            setIsOpen(false)
          }}>
          <ContextMenuRow icon={item.icon} variant={item.variant}>
            {item.title}
          </ContextMenuRow>
        </MenuItem>
      ))}

      <ContextMenuDivider />

      <MenuItem
        onClick={() => {
          tocActions.deleteSection(headingId)
          setIsOpen(false)
        }}>
        <ContextMenuRow icon={<Icons.trash size={16} />} variant="danger" className="items-center">
          <span className="flex items-center gap-1.5">
            Delete Section
            <Tooltip
              title="Delete this heading and all nested sub-headings beneath it"
              placement="right"
              className="max-w-48 text-pretty">
              <span className="flex items-center">
                <Icons.info size={14} className="opacity-60" />
              </span>
            </Tooltip>
          </span>
        </ContextMenuRow>
      </MenuItem>
    </>
  )
}
