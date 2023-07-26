import { useState } from 'react'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import Button from '../../../../components/Button'
import { ShieldCheck, Bell, AngleSmallRight, Exit } from '@icons'
import { Avatar } from '../../../../components/Avatar'
import dynamic from 'next/dynamic'

const ProfileTab = dynamic(() => import('./ProfileTab'), {
  loading: () => <div>Loading...</div>
})

import SecurityTab from './SecurityTab'
import NotificationsTab from './NotificationsTab'
import { toast } from 'react-hot-toast'

const ProfilePanel = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()
  const [loadSignOut, setLoadSignOut] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  const signOut = async () => {
    setLoadSignOut(true)
    const { error } = await supabaseClient.auth.signOut()
    if (error) {
      toast.error('Error signOut:' + error.message)
    }
    window.location = window.location.pathname
  }

  const changeTab = (tab) => {
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
              defaultURI={user?.user_metadata?.avatar_url}
              width={22}
              height={22}
              className="rounded-full mr-2 border"
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
        <Button onClick={signOut} className="mt-40" Icon={Exit} iconSize={18} loading={loadSignOut}>
          Sign-out
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
