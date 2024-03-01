import { useState } from 'react'
import Button from '@components/ui/Button'
import { ShieldCheck, Bell, AngleSmallRight, Exit } from '@icons'
import { Avatar } from '@components/ui/Avatar'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@stores'
import { toast } from 'react-hot-toast'
import { supabaseClient } from '@utils/supabase'
import Loading from '@components/ui/Loading'
import { LuLogOut } from 'react-icons/lu'

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
        <ul className="">
          <li
            className={`flex align-baseline justify-start py-3 rounded-md px-2 cursor-pointer ${
              activeTab === 'profile' && 'bg-slate-200 drop-shadow-sm'
            }`}
            onClick={() => {
              changeTab('profile')
            }}>
            <Avatar
              id={user?.id}
              src={user?.avatar_url}
              alt={displayName}
              className="rounded-full mr-2 border w-6 scale-125"
            />
            Profile
            <AngleSmallRight size={20} className="ml-auto" />
          </li>
          <li
            className={`flex align-baseline justify-start py-3 rounded-md px-2 cursor-pointer ${
              activeTab === 'security' && 'bg-slate-200 drop-shadow-sm'
            }`}
            onClick={() => {
              changeTab('security')
            }}>
            <ShieldCheck size={20} className="mr-2" />
            Security
            <AngleSmallRight size={20} className="ml-auto" />
          </li>
          <li
            className={`flex align-baseline justify-start py-3 rounded-md px-2 cursor-pointer ${
              activeTab === 'notifications' && 'bg-slate-200 drop-shadow-sm'
            }`}
            onClick={() => {
              changeTab('notifications')
            }}>
            <Bell size={20} className="mr-2" />
            Notifications
            <AngleSmallRight size={20} className="ml-auto" />
          </li>
        </ul>
        <div className="border rounded-md p-4 mt-10 flex flex-col text-base antialiased">
          <a href="#" target="_blank" className="mt-2">
            FAQ
          </a>
          <a href="#" target="_blank" className="mt-2">
            Request a feature
          </a>
          <a href="#" target="_blank" className="mt-2">
            Report an issue
          </a>
          <a href="#" target="_blank" className="mt-2">
            Privacy policy
          </a>
          <a href="#" target="_blank" className="mt-2">
            Terms of service
          </a>
        </div>
        <Button
          onClick={signOut}
          className="mt-40 join-item btn-block flex items-center justify-center"
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
