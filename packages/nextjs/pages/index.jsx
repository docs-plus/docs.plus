import HeadSeo from '../components/HeadSeo'
import Image from 'next/image'
import { useUser } from '@supabase/auth-helpers-react'
import dynamic from 'next/dynamic'
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '../components/Tabs/Tabs'
import DeckPanel from './components/panels/DeckPanel'
import { useEditorStateContext } from '../context/EditorContext'

const DashboardLayout = dynamic(() => import('./layouts/DashboardLayout'))
const SignInPanel = dynamic(() => import('./components/panels/SignInPanel'), {
  loading: () => <div>Loading...</div>,
})
const DocumentsPanel = dynamic(() =>
  import('./components/panels/DocumentsPanel')
)
const ProfilePanel = dynamic(() => import('./components/panels/ProfilePanel'))

function TabLayout({ children }) {
  return (
    <TabPanel className="flex flex-wrap sm:justify-center sm:m-auto p-2 sm:p-6 sm:py-6 pb-2 sm:pb-2">
      <DashboardLayout>{children}</DashboardLayout>
    </TabPanel>
  )
}

export default function Home() {
  const user = useUser()
  const { isAuthServiceAvailable } = useEditorStateContext()

  return (
    <div>
      <HeadSeo title="Docs Plus" description="Docs Plus application" />
      <div className="grid h-screen place-items-center w-full bg-slate-100 p-4">
        <Tabs defaultActiveTab="deck" className="max-w-5xl rounded-md relative">
          <TabList
            className={`${
              isAuthServiceAvailable ? 'flex' : 'hidden'
            } bg-slate-200 rounded-t-md relative drop-shadow-md z-0 -bottom-1 `}>
            <Tab name="deck">Docs.plus Deck</Tab>
            {isAuthServiceAvailable && user && (
              <Tab name="documents">Documents</Tab>
            )}
            {isAuthServiceAvailable && !user && (
              <Tab name="sign-in" className="ml-auto">
                Sign in
              </Tab>
            )}
            {isAuthServiceAvailable && user && (
              <Tab name="profile" className="ml-auto py-2">
                <Image
                  className="rounded-full drop-shadow border w-10 h-10"
                  src={user?.user_metadata?.avatar_url}
                  alt="Profile Picture"
                  width={40}
                  height={40}
                />
              </Tab>
            )}
          </TabList>
          <TabPanels className="bg-white rounded-md shadow max-w-5xl relative z-10">
            <TabLayout name="deck">
              <DeckPanel />
            </TabLayout>
            {isAuthServiceAvailable && user && (
              <TabLayout name="documents">
                <DocumentsPanel />
              </TabLayout>
            )}
            {isAuthServiceAvailable && !user && (
              <TabLayout name="sign-in">
                <SignInPanel />
              </TabLayout>
            )}
            {isAuthServiceAvailable && user && (
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
