import {
  MdChat,
  MdOutlineUnfoldLess,
  MdCenterFocusStrong,
  MdLink,
  MdDelete,
  MdOutlineUnfoldMore
} from 'react-icons/md'
import useOpenChatroomHandler from '../hooks/useOpenChatroomHandler'
import useToggleHeadingSectionHandler from '../hooks/ueToggleHeadingSectionHandler'
import { MenuItem } from '@components/ui/ContextMenu'
import { useContextMenuContext } from '@components/ui/ContextMenu'
import useLinkHeadingSectionHandler from '../hooks/useLinkHeadingSectionHandler'
import useFocusHeadingSectionHandler from '../hooks/useFocusHeadingSectionHandler'
import useDeleteHeadingSectionHandler from '../hooks/useDeleteHeadingSectionHandler'
import { MdOutlineInfo } from 'react-icons/md'
import useInsertH1Handler from '../hooks/useInsertH1Handler'

const ContextMenuItems = ({ tocItem }: { tocItem: Element | null }) => {
  const headingId = tocItem?.getAttribute('data-id') ?? null
  const isOpen = tocItem?.classList.contains('closed') ? false : true
  const { setIsOpen } = useContextMenuContext()

  // find closet heading
  const headingEl = document.querySelector(`.heading[data-id="${headingId}"]`)
  const headingLevel = headingEl?.getAttribute('level')

  if (!headingId) return null

  const openChatroomHandler = useOpenChatroomHandler(headingId)
  const toggleHeadingSectionHandler = useToggleHeadingSectionHandler(headingId, isOpen)
  const linkHeadingSectionHandler = useLinkHeadingSectionHandler(headingId)
  const focusHeadingSectionHandler = useFocusHeadingSectionHandler(headingId)
  const deleteHeadingSectionHandler = useDeleteHeadingSectionHandler(headingId)
  const insertH1Handler = useInsertH1Handler(headingId)

  const tocButtonList = [
    {
      title: 'Chat Room',
      icon: <MdChat size={18} />,
      onClickFn: openChatroomHandler,
      display: true,
      className: 'text-docsy'
    },
    {
      title: `${isOpen ? 'Fold' : 'Unfold'} Section`,
      icon: isOpen ? <MdOutlineUnfoldLess size={18} /> : <MdOutlineUnfoldMore size={18} />,
      onClickFn: toggleHeadingSectionHandler,
      display: true,
      className: ''
    },
    {
      title: 'Focus Section',
      icon: <MdCenterFocusStrong size={18} />,
      onClickFn: focusHeadingSectionHandler,
      display: true,
      className: ''
    },
    {
      title: 'Link Section',
      icon: <MdLink size={18} />,
      onClickFn: linkHeadingSectionHandler,
      display: true,
      className: ''
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
      onClickFn: deleteHeadingSectionHandler,
      display: true,
      className: 'mt-1 border-t border-gray-300 pt-1 text-red-500'
    }
  ]

  const insertButtonList = [
    {
      title: 'Heading',
      icon: <span className="bg-docsy/80 rounded-md px-1 text-xs font-bold text-white">H1</span>,
      onClickFn: insertH1Handler,
      display: true,
      className: 'bg-base-300 my-1 rounded-md'
    },
    {
      title: 'Above',
      icon: (
        <span className="bg-docsy/80 rounded-md px-1 text-xs font-bold text-white">
          H{headingLevel}
        </span>
      ),
      onClickFn: () => {
        // Handle add above action
      },
      display: true,
      className: ''
    },
    {
      title: 'Below',
      icon: (
        <span className="bg-docsy/80 rounded-md px-1 text-xs font-bold text-white">
          H{headingLevel}
        </span>
      ),
      onClickFn: () => {
        // Handle add below action
      },
      display: true,
      className: ''
    }
  ]

  return (
    <>
      {tocButtonList
        .filter((button) => button.display)
        .map((button, index) => (
          <MenuItem
            key={index}
            className={button.className}
            onClick={(e) => {
              button.onClickFn()
              setIsOpen(false)
            }}>
            <a className="flex items-center gap-2">
              {button.icon}
              {button.title}
            </a>
          </MenuItem>
        ))}
      <li className="mt-1 border-t border-gray-300 pt-1">
        <details>
          <summary className="">Insert</summary>
          <ul>
            {insertButtonList
              .filter((button) => button.display)
              .map((button, index) => (
                <MenuItem
                  key={index}
                  className={button.className}
                  onClick={(e) => {
                    button.onClickFn()
                    setIsOpen(false)
                  }}>
                  <a className="flex items-center gap-2">
                    {button.icon}
                    {button.title}
                  </a>
                </MenuItem>
              ))}
          </ul>
        </details>
      </li>
    </>
  )
}

export default ContextMenuItems
