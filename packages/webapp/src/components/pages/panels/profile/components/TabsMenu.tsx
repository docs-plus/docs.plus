import { Avatar } from '@components/ui/Avatar'
import { RiShieldCheckLine, RiArrowRightSLine } from 'react-icons/ri'
import { HiOutlineDocumentText } from 'react-icons/hi'
import { LuBell } from 'react-icons/lu'
import { useAuthStore } from '@stores'

interface TabsMenuProps {
  activeTab: string
  changeTab: (tab: string) => void
}

const TabsMenu = ({ activeTab, changeTab }: TabsMenuProps) => {
  const user = useAuthStore((state) => state.profile)

  return (
    <ul className="menu menu-md flex w-full space-y-2 pl-0">
      <li onClick={() => changeTab('profile')}>
        <a href="#" className={`${activeTab === 'profile' ? 'active' : ''}`}>
          <Avatar
            id={user?.id}
            avatarUpdatedAt={user?.avatar_updated_at}
            src={user?.avatar_url}
            alt={user?.display_name}
            className="mr-2 w-6 scale-125 rounded-full border"
          />
          Profile
          <RiArrowRightSLine size={20} className="ml-auto" />
        </a>
      </li>
      <li onClick={() => changeTab('documents')}>
        <a href="#" className="mt-2">
          <HiOutlineDocumentText size={22} className="ml-auto" />
          Documents
          <RiArrowRightSLine size={20} className="ml-auto" />
        </a>
      </li>
      <li onClick={() => changeTab('security')}>
        <a href="#" className={`${activeTab === 'security' ? 'active' : ''}`}>
          <RiShieldCheckLine size={22} className="mr-2" />
          Security
          <RiArrowRightSLine size={20} className="ml-auto" />
        </a>
      </li>
      <li onClick={() => changeTab('notifications')}>
        <a href="#" className={`${activeTab === 'notifications' ? 'active' : ''}`}>
          <LuBell size={22} className="mr-2" />
          Notifications
          <RiArrowRightSLine size={20} className="ml-auto" />
        </a>
      </li>
    </ul>
  )
}

export default TabsMenu
