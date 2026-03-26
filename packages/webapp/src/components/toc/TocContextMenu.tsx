import { MenuItem, useContextMenuContext } from '@components/ui/ContextMenu'
import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'

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

  const headingEl = document.querySelector(`[data-toc-id="${headingId}"]`)
  const headingLevel = headingEl?.tagName?.match(/^H(\d)$/)?.[1] ?? null

  const menuItems = [
    {
      title: 'Chat Room',
      icon: <Icons.chatroom size={16} />,
      onClick: () => openChatroom(headingId, { scrollTo: true }),
      className: 'text-primary'
    },
    {
      title: isOpen ? 'Fold Section' : 'Unfold Section',
      icon: isOpen ? <Icons.foldVertical size={16} /> : <Icons.unfoldVertical size={16} />,
      onClick: () => onToggle(headingId),
      className: ''
    },
    {
      title: 'Focus Section',
      icon: <Icons.crosshair size={16} />,
      onClick: () => focusSection(headingId),
      className: ''
    },
    {
      title: 'Link Section',
      icon: <Icons.link size={16} />,
      onClick: () => copyLink(headingId),
      className: ''
    }
  ]

  const dangerItem = {
    title: (
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
    ),
    icon: <Icons.trash size={16} />,
    onClick: () => deleteSection(headingId)
  }

  const insertItems = [
    {
      title: 'Heading',
      badge: 'H1',
      onClick: () => {
        // TODO: Implement insert H1 handler
      },
      highlight: true
    },
    {
      title: 'Above',
      badge: `H${headingLevel}`,
      onClick: () => {
        // TODO: Implement insert above handler
      }
    },
    {
      title: 'Below',
      badge: `H${headingLevel}`,
      onClick: () => {
        // TODO: Implement insert below handler
      }
    }
  ]

  return (
    <>
      {/* Primary actions */}
      {menuItems.map((item, index) => (
        <MenuItem
          key={index}
          className={`${item.className} rounded-lg`}
          onClick={() => {
            item.onClick()
            setIsOpen(false)
          }}>
          <a className="hover:bg-base-200 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors">
            <span className="flex-shrink-0 opacity-70">{item.icon}</span>
            <span className="font-medium">{item.title}</span>
          </a>
        </MenuItem>
      ))}

      {/* Danger zone — separated */}
      <MenuItem
        className="border-base-300 mt-1 rounded-lg border-t pt-1"
        onClick={() => {
          dangerItem.onClick()
          setIsOpen(false)
        }}>
        <a className="hover:bg-error/10 text-error flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors">
          <span className="flex-shrink-0">{dangerItem.icon}</span>
          <span className="font-medium">{dangerItem.title}</span>
        </a>
      </MenuItem>

      {/* Insert sub-menu */}
      <li className="border-base-300 mt-1 border-t pt-1">
        <details>
          <summary className="hover:bg-base-200 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors">
            Insert
          </summary>
          <ul className="bg-base-100 mt-0.5 space-y-0.5 rounded-lg p-1">
            {insertItems.map((item, index) => (
              <MenuItem
                key={index}
                className={item.highlight ? 'bg-base-200 rounded-md' : 'rounded-md'}
                onClick={() => {
                  item.onClick()
                  setIsOpen(false)
                }}>
                <a className="hover:bg-base-200 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors">
                  <span className="bg-primary/80 text-primary-content inline-flex items-center justify-center rounded px-1.5 text-xs leading-5 font-bold">
                    {item.badge}
                  </span>
                  <span>{item.title}</span>
                </a>
              </MenuItem>
            ))}
          </ul>
        </details>
      </li>
    </>
  )
}
