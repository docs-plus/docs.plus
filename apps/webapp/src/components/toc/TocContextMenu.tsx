import {
  ContextMenuDivider,
  ContextMenuRow,
  MenuItem,
  useContextMenuContext
} from '@components/ui/ContextMenu'
import { selectDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'

import { tocActions } from './hooks'
import { outlineOf } from './utils/outline'

interface TocContextMenuProps {
  headingId: string | null
  isOpen: boolean
  onToggle: (id: string) => void
}

export function TocContextMenu({ headingId, isOpen, onToggle }: TocContextMenuProps) {
  const { setIsOpen } = useContextMenuContext()
  const editor = useStore((s) => s.settings.editor.instance)
  const profileId = useAuthStore((s) => s.profile?.id)
  const locked = useStore((s) => selectDocumentEditingLocked(s.settings, profileId))

  if (!headingId) return null

  // Same rule as removeSectionNow, so the menu never offers a delete that does nothing.
  // Read at render: the menu re-renders on each open, so the doc is current.
  const target = editor ? outlineOf(editor.state.doc).find((n) => n.id === headingId) : undefined
  const canDelete = !locked && !!editor?.isEditable && !!target && !target.isTitle

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

      {canDelete && (
        <>
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
      )}
    </>
  )
}
