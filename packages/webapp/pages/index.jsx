import HeadSeo from '@components/HeadSeo'
import dynamic from 'next/dynamic'
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@components/ui/Tabs/Tabs'
import DeckPanel from '@pages/panels/DeckPanel'
import { useEditorStateContext } from '@context/EditorContext'
import { Avatar } from '@components/Avatar'
import { DocsPlus } from '@icons'
import { twMerge } from 'tailwind-merge'
import { useAuthStore } from '@utils/supabase'

const DashboardLayout = dynamic(() => import('@pages/document/layouts/DashboardLayout'))
const SignInPanel = dynamic(() => import('@pages/panels/SignInPanel'), {
  loading: () => <div>Loading...</div>
})
const DocumentsPanel = dynamic(() => import('@pages/panels/DocumentsPanel'))
const ProfilePanel = dynamic(() => import('@pages/panels/profile/ProfilePanel'))

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

function Home({ hostname }) {
  const user = useAuthStore.use.user()
  const { isAuthServiceAvailable } = useEditorStateContext()
  const isUserSignedIn = user && isAuthServiceAvailable

  return (
    <div>
      <HeadSeo title="docs.plus" description="docs.plus application" />
      <div className="grid h-full w-full sm:h-screen place-items-center bg-slate-100 p-4">
        <Tabs defaultActiveTab="deck" className="max-w-5xl rounded-md relative">
          <TabList
            className={`${
              isAuthServiceAvailable ? 'flex' : 'hidden'
            } bg-slate-200 rounded-t-md relative drop-shadow-md z-0 -bottom-1 `}>
            <Tab name="deck" className="flex items-center ">
              <DocsPlus size={26} />
            </Tab>
            {isUserSignedIn && <Tab name="documents">Documents</Tab>}
            {isAuthServiceAvailable && !user && (
              <Tab name="sign-in" className="ml-auto">
                Sign in
              </Tab>
            )}
            {isUserSignedIn && (
              <Tab name="profile" className="ml-auto py-2">
                <Avatar
                  width={22}
                  height={22}
                  className="rounded-full drop-shadow border w-10 h-10"
                />
              </Tab>
            )}
          </TabList>
          <TabPanels className="bg-white rounded-md shadow max-w-5xl relative z-10">
            <TabLayout name="deck">
              <DeckPanel hostname={hostname} />
            </TabLayout>
            {isUserSignedIn && (
              <TabLayout name="documents">
                <DocumentsPanel />
              </TabLayout>
            )}
            {isAuthServiceAvailable && !user && (
              <TabLayout name="sign-in" footer={false} className="sm:w-[28rem] w-full p-6 sm:p-6">
                <SignInPanel />
              </TabLayout>
            )}
            {isUserSignedIn && (
              <TabLayout name="profile">
                <ProfilePanel />
              </TabLayout>
            )}
          </TabPanels>
        </Tabs>
      </div>
    </div>
  )
}

export default Home

export async function getServerSideProps(context) {
  return {
    props: { hostname: context.req?.headers?.host }
  }
}
