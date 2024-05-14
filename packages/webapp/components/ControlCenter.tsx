import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@components/ui/Tabs/Tabs'
import dynamic from 'next/dynamic'
import SignInPanel from '@pages/panels/SignInPanel'
import ProfilePanel from '@pages/panels/profile/ProfilePanel'
import { twMerge } from 'tailwind-merge'
import { useAuthStore } from '@stores'

const DashboardLayout = dynamic(() => import('@pages/document/layouts/DashboardLayout'))
const DocumentsPanel = dynamic(() => import('@pages/panels/DocumentsPanel'))

function TabLayout({ name, children, className, footer }: any) {
  return (
    <TabPanel
      name={name}
      className={twMerge(
        `flex flex-wrap p-2 pb-2 sm:m-auto sm:justify-center sm:p-6 sm:py-6 sm:pb-2`,
        className
      )}>
      <DashboardLayout footer={footer}>{children}</DashboardLayout>
    </TabPanel>
  )
}

const ControlCenter = ({ defaultTab }: any) => {
  const user = useAuthStore((state) => state.profile)

  return (
    <div className="rounded-md bg-slate-100 drop-shadow">
      <Tabs
        defaultActiveTab={user ? (defaultTab ? defaultTab : 'profile') : 'sign-in'}
        className="relative max-w-5xl rounded-md">
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
        <TabPanels className="relative -top-1 z-10 max-w-5xl rounded-md bg-white">
          {!user && (
            <TabLayout name="sign-in" footer={false} className="w-full p-6 sm:w-[28rem] sm:p-6">
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
