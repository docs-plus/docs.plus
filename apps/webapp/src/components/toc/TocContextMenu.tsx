import {
  ContextMenuDivider,
  ContextMenuRow,
  MenuItem,
  useContextMenuContext
} from '@components/ui/ContextMenu'
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
      title: 'Chat room',
      icon: <Icons.chatroom size={16} />,
      onClick: () => tocActions.openChatroom(headingId, { scrollTo: true })
    },
    {
      title: isOpen ? 'Fold section' : 'Unfold section',
      icon: isOpen ? <Icons.foldVertical size={16} /> : <Icons.unfoldVertical size={16} />,
      onClick: () => onToggle(headingId)
    },
    {
      title: 'Focus section',
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
          <ContextMenuRow icon={item.icon}>{item.title}</ContextMenuRow>
        </MenuItem>
      ))}

      <ContextMenuDivider />

      <MenuItem
        onClick={() => {
          tocActions.deleteSection(headingId)
          setIsOpen(false)
        }}>
        <ContextMenuRow icon={<Icons.trash size={16} />} variant="danger">
          Delete section
        </ContextMenuRow>
      </MenuItem>
    </>
  )
}
