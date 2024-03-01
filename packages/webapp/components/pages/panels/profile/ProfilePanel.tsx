import { useState } from 'react'
import Button from '@components/ui/Button'
import { Avatar } from '@components/ui/Avatar'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@stores'
import { toast } from 'react-hot-toast'
import Loading from '@components/ui/Loading'
import { LuLogOut } from 'react-icons/lu'
import { RiShieldCheckLine, RiArrowRightSLine } from 'react-icons/ri'
import { LuBell } from 'react-icons/lu'
import { createClient } from '@utils/supabase/components'

const ProfileTab = dynamic(() => import('./ProfileTab'), {
  loading: () => <Loading />
})
const SecurityTab = dynamic(() => import('./SecurityTab'), {
  loading: () => <Loading />
})
const NotificationsTab = dynamic(() => import('./NotificationsTab'), {
  loading: () => <Loading />
})

const ProfilePanel = () => {
  const [loadSignOut, setLoadSignOut] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const displayName = useAuthStore((state) => state.profile?.display_name)
  const user = useAuthStore((state) => state.profile)
  const supabaseClient = createClient()

  const signOut = async () => {
    setLoadSignOut(true)
    const { error } = await supabaseClient.auth.signOut()
    if (error) {
      toast.error('Error signOut:' + error.message)
    }
    window.location.assign(window.location.pathname)
  }

  const changeTab = (tab: string) => {
    setActiveTab(tab)
  }

  return (
    <>
      <div className="w-4/12 p-4 px-6 relative">
        <ul className="menu flex space-y-2  pl-0">
          <li
            onClick={() => {
              changeTab('profile')
            }}>
            <a href="#" className={`${activeTab === 'profile' ? 'active' : ''}`}>
              <Avatar
                id={user?.id}
                src={user?.avatar_url}
                alt={displayName}
                className="rounded-full mr-2 border w-6 scale-125"
              />
              Profile
              <RiArrowRightSLine size={20} className="ml-auto" />
            </a>
          </li>
          <li
            onClick={() => {
              changeTab('security')
            }}>
            <a href="#" className={`${activeTab === 'security' ? 'active ' : ''}`}>
              <RiShieldCheckLine size={22} className="mr-2" />
              Security
              <RiArrowRightSLine size={20} className="ml-auto" />
            </a>
          </li>
          <li
            onClick={() => {
              changeTab('notifications')
            }}>
            <a href="#" className={`${activeTab === 'notifications' ? 'active' : ''}`}>
              <LuBell size={22} className="mr-2" />
              Notifications
              <RiArrowRightSLine size={20} className="ml-auto" />
            </a>
          </li>
        </ul>
        <div className="divider"></div>
        <div className=" rounded-md flex flex-col">
          <ul className="menu">
            <li>
              <a href="#" target="_blank" className="mt-2">
                FAQ
              </a>
            </li>
            <li>
              <a href="#" target="_blank" className="mt-2">
                Request a feature
              </a>
            </li>
            <li>
              <a href="#" target="_blank" className="mt-2">
                Report an issue
              </a>
            </li>
            <li>
              <a href="#" target="_blank" className="mt-2">
                Privacy policy
              </a>
            </li>
            <li>
              <a href="#" target="_blank" className="mt-2">
                Terms of service
              </a>
            </li>
          </ul>
        </div>
        <Button
          onClick={signOut}
          className="mt-28 join-item btn-block flex items-center justify-center"
          loading={loadSignOut}>
          <LuLogOut size={18} className="mr-auto" />
          <span className="mr-auto -ml-[24px]">Sign-out</span>
        </Button>
      </div>
      <div className="w-8/12 p-4">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>
    </>
  )
}

export default ProfilePanel
