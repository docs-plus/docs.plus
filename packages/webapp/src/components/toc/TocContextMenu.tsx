import {
  ContextMenuDivider,
  ContextMenuRow,
  MenuItem,
  useContextMenuContext
} from '@components/ui/ContextMenu'
import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

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
      onClick: () => focusSection(headingId)
    },
    {
      title: 'Link Section',
      icon: <Icons.link size={16} />,
      onClick: () => copyLink(headingId)
    }
  ]

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
          deleteSection(headingId)
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

      <ContextMenuDivider />

      <li>
        <details>
          <summary className="hover:bg-base-300 cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150">
            Insert
          </summary>
          <ul className="bg-base-100 mt-0.5 space-y-0.5 rounded-lg p-1">
            {insertItems.map((item) => (
              <MenuItem
                key={item.title}
                className={twMerge('rounded-md', item.highlight && 'bg-base-200')}
                onClick={() => {
                  item.onClick()
                  setIsOpen(false)
                }}>
                <ContextMenuRow
                  dimIcon={false}
                  className="py-1.5"
                  icon={
                    <span className="bg-primary/80 text-primary-content inline-flex items-center justify-center rounded px-1.5 text-xs leading-5 font-bold">
                      {item.badge}
                    </span>
                  }>
                  {item.title}
                </ContextMenuRow>
              </MenuItem>
            ))}
          </ul>
        </details>
      </li>
    </>
  )
}
