import {
  MdChat,
  MdOutlineUnfoldLess,
  MdOutlineUnfoldMore,
  MdCenterFocusStrong,
  MdLink,
  MdDelete,
  MdOutlineInfo
} from 'react-icons/md'
import { MenuItem, useContextMenuContext } from '@components/ui/ContextMenu'
import { useTocActions } from './hooks'

interface TocContextMenuProps {
  headingId: string | null
  isOpen: boolean
  onToggle: (id: string) => void
}

export function TocContextMenu({ headingId, isOpen, onToggle }: TocContextMenuProps) {
  const { setIsOpen } = useContextMenuContext()
  const { openChatroom, copyLink, focusSection, deleteSection } = useTocActions()

  if (!headingId) return null

  // Get heading level for insert submenu
  const headingEl = document.querySelector(`.heading[data-id="${headingId}"]`)
  const headingLevel = headingEl?.getAttribute('level')

  const menuItems = [
    {
      title: 'Chat Room',
      icon: <MdChat size={18} />,
      onClick: () => openChatroom(headingId, { scrollTo: true }),
      className: 'text-docsy'
    },
    {
      title: isOpen ? 'Fold Section' : 'Unfold Section',
      icon: isOpen ? <MdOutlineUnfoldLess size={18} /> : <MdOutlineUnfoldMore size={18} />,
      onClick: () => onToggle(headingId)
    },
    {
      title: 'Focus Section',
      icon: <MdCenterFocusStrong size={18} />,
      onClick: () => focusSection(headingId)
    },
    {
      title: 'Link Section',
      icon: <MdLink size={18} />,
      onClick: () => copyLink(headingId)
    },
    {
      title: (
        <>
          Delete Section
          <span className="tooltip tooltip-right flex items-center gap-2">
            <span className="tooltip-content w-48 text-pretty">
              Delete this heading and all nested sub-headings beneath it
            </span>
            <MdOutlineInfo size={18} />
          </span>
        </>
      ),
      icon: <MdDelete size={18} />,
      onClick: () => deleteSection(headingId),
      className: 'mt-1 border-t border-gray-300 pt-1 text-red-500'
    }
  ]

  const insertItems = [
    {
      title: 'Heading',
      icon: <span className="bg-docsy/80 rounded-md px-1 text-xs font-bold text-white">H1</span>,
      onClick: () => {
        // TODO: Implement insert H1 handler
      },
      className: 'bg-base-300 my-1 rounded-md'
    },
    {
      title: 'Above',
      icon: (
        <span className="bg-docsy/80 rounded-md px-1 text-xs font-bold text-white">
          H{headingLevel}
        </span>
      ),
      onClick: () => {
        // TODO: Implement insert above handler
      }
    },
    {
      title: 'Below',
      icon: (
        <span className="bg-docsy/80 rounded-md px-1 text-xs font-bold text-white">
          H{headingLevel}
        </span>
      ),
      onClick: () => {
        // TODO: Implement insert below handler
      }
    }
  ]

  return (
    <>
      {menuItems.map((item, index) => (
        <MenuItem
          key={index}
          className={item.className}
          onClick={() => {
            item.onClick()
            setIsOpen(false)
          }}>
          <a className="flex items-center gap-2">
            {item.icon}
            {item.title}
          </a>
        </MenuItem>
      ))}
      <li className="mt-1 border-t border-gray-300 pt-1">
        <details>
          <summary>Insert</summary>
          <ul>
            {insertItems.map((item, index) => (
              <MenuItem
                key={index}
                className={item.className}
                onClick={() => {
                  item.onClick()
                  setIsOpen(false)
                }}>
                <a className="flex items-center gap-2">
                  {item.icon}
                  {item.title}
                </a>
              </MenuItem>
            ))}
          </ul>
        </details>
      </li>
    </>
  )
}
