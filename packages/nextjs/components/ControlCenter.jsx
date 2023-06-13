import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@components/Tabs/Tabs'
import Avatar from '@components/Avatar'
import dynamic from 'next/dynamic'
import { useUser } from '@supabase/auth-helpers-react'
import SignInPanel from '@pages/panels/SignInPanel'
import ProfilePanel from '@pages/panels/profile/ProfilePanel'

const DashboardLayout = dynamic(() => import('@pages/document/layouts/DashboardLayout'))

function TabLayout({ children }) {
  return (
    <TabPanel className="flex flex-wrap sm:justify-center sm:m-auto p-2 sm:p-6 sm:py-6 pb-2 sm:pb-2">
      <DashboardLayout>{children}</DashboardLayout>
    </TabPanel>
  )
}

const ControlCenter = () => {
  const user = useUser()

  return (
    <div className="bg-slate-100 rounded-md drop-shadow">
      <Tabs defaultActiveTab={user ? 'profile' : 'sign-in'} className="max-w-5xl rounded-md relative">
        <TabList>
          {!user && (
            <Tab name="sign-in" className="">
              Sign in
            </Tab>
          )}
          {user && (
            <Tab name="profile" className="">
              Profile
            </Tab>
          )}
        </TabList>
        <TabPanels className="bg-white rounded-md  max-w-5xl -top-1 relative z-10">
          {!user && (
            <TabLayout name="sign-in">
              <SignInPanel />
            </TabLayout>
          )}
          {user && (
            <TabLayout name="profile">
              <ProfilePanel />
            </TabLayout>
          )}
        </TabPanels>
      </Tabs>
    </div>
  )
}

export default ControlCenter
