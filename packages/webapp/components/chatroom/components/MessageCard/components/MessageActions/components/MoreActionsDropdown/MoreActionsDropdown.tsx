import Dropdown from '@components/ui/Dropdown'
import { MdMoreVert } from 'react-icons/md'

type Props = {
  className?: string
  children?: React.ReactNode
}

const DropdownButton = ({ className }: Props) => {
  return (
    <button className="btn btn-sm btn-square join-item btn-ghost">
      <MdMoreVert size={20} className="text-gray-600" />
    </button>
  )
}

export const MoreActionsDropdown = ({ children, className }: Props) => {
  return (
    <Dropdown
      button={<DropdownButton />}
      className="dropdown-bottom dropdown-end"
      contentClassName="dropdown-content bg-base-100 overflow-hidden rounded-box z-[1] border border-gray-300 shadow-md">
      <ul className="menu bg-base-100 w-52 !p-1">{children}</ul>
    </Dropdown>
  )
}
