import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@components/ui/Tabs/Tabs'
import dynamic from 'next/dynamic'
import { useUser } from '@supabase/auth-helpers-react'
import SignInPanel from '@pages/panels/SignInPanel'
import ProfilePanel from '@pages/panels/profile/ProfilePanel'
import { twMerge } from 'tailwind-merge'

const DashboardLayout = dynamic(() => import('@pages/document/layouts/DashboardLayout'))
const DocumentsPanel = dynamic(() => import('@pages/panels/DocumentsPanel'))

function TabLayout({ children, className, footer }) {
  return (
    <TabPanel
      className={twMerge(
        `flex flex-wrap sm:justify-center sm:m-auto p-2 sm:p-6 sm:py-6 pb-2 sm:pb-2`,
        className
      )}>
      <DashboardLayout footer={footer}>{children}</DashboardLayout>
    </TabPanel>
  )
}

const ControlCenter = () => {
  const user = useUser()

  return (
    <div className="bg-slate-100  rounded-md drop-shadow">
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
          {user && <Tab name="documents">Documents</Tab>}
        </TabList>
        <TabPanels className="bg-white rounded-md  max-w-5xl -top-1 relative z-10">
          {!user && (
            <TabLayout name="sign-in" footer={false} className="sm:w-[28rem] w-full p-6 sm:p-6">
              <SignInPanel />
            </TabLayout>
          )}
          {user && (
            <TabLayout name="profile">
              <ProfilePanel />
            </TabLayout>
          )}
          {user && (
            <TabLayout name="documents">
              <DocumentsPanel />
            </TabLayout>
          )}
        </TabPanels>
      </Tabs>
    </div>
  )
}

export default ControlCenter
