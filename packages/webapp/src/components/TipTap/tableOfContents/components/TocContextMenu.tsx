import React, { useCallback, useMemo } from 'react'
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
import { useStore } from '@stores'
import { useHeadingActions, useOpenChat } from '../hooks'
import DeleteConfirmDialog from './DeleteConfirmDialog'

interface TocContextMenuProps {
  tocElement: Element | null
}

const TocContextMenu = ({ tocElement }: TocContextMenuProps) => {
  const headingId = tocElement?.getAttribute('data-id') ?? null
  const isOpen = tocElement ? !tocElement.classList.contains('closed') : true
  const { setIsOpen } = useContextMenuContext()
  const { openDialog } = useStore()

  const openChat = useOpenChat()
  const { toggleFold, focusSection, copyLink } = useHeadingActions()

  const closeMenu = useCallback(() => setIsOpen(false), [setIsOpen])

  const handleOpenChat = useCallback(() => {
    if (headingId) {
      openChat(headingId, { scrollTo: true })
      closeMenu()
    }
  }, [headingId, openChat, closeMenu])

  const handleToggleFold = useCallback(() => {
    if (headingId) {
      toggleFold(headingId)
      closeMenu()
    }
  }, [headingId, toggleFold, closeMenu])

  const handleFocusSection = useCallback(() => {
    if (headingId) {
      focusSection(headingId)
      closeMenu()
    }
  }, [headingId, focusSection, closeMenu])

  const handleCopyLink = useCallback(() => {
    if (headingId) {
      copyLink(headingId)
      closeMenu()
    }
  }, [headingId, copyLink, closeMenu])

  const handleDelete = useCallback(() => {
    if (headingId) {
      openDialog(<DeleteConfirmDialog headingId={headingId} />)
      closeMenu()
    }
  }, [headingId, openDialog, closeMenu])

  const menuItems = useMemo(
    () => [
      {
        title: 'Chat Room',
        icon: <MdChat size={18} />,
        onClick: handleOpenChat,
        className: 'text-docsy'
      },
      {
        title: isOpen ? 'Fold Section' : 'Unfold Section',
        icon: isOpen ? <MdOutlineUnfoldLess size={18} /> : <MdOutlineUnfoldMore size={18} />,
        onClick: handleToggleFold
      },
      {
        title: 'Focus Section',
        icon: <MdCenterFocusStrong size={18} />,
        onClick: handleFocusSection
      },
      {
        title: 'Copy Link',
        icon: <MdLink size={18} />,
        onClick: handleCopyLink
      },
      {
        title: (
          <span className="flex items-center gap-2">
            Delete Section
            <span className="tooltip tooltip-right">
              <span className="tooltip-content w-48 text-pretty">
                Delete this heading and all nested sub-headings
              </span>
              <MdOutlineInfo size={18} />
            </span>
          </span>
        ),
        icon: <MdDelete size={18} />,
        onClick: handleDelete,
        className: 'mt-1 border-t border-gray-300 pt-1 text-red-500'
      }
    ],
    [isOpen, handleOpenChat, handleToggleFold, handleFocusSection, handleCopyLink, handleDelete]
  )

  if (!headingId) return null

  return (
    <>
      {menuItems.map((item, index) => (
        <MenuItem key={index} className={item.className} onClick={item.onClick}>
          <a className="flex items-center gap-2">
            {item.icon}
            {item.title}
          </a>
        </MenuItem>
      ))}
    </>
  )
}

export default TocContextMenu
