import { GetServerSidePropsContext } from 'next'
import HeadSeo from '@components/HeadSeo'
import dynamic from 'next/dynamic'
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@components/ui/Tabs/Tabs'
import DeckPanel from '@pages/panels/DeckPanel'
import { Avatar } from '@components/ui/Avatar'
import { DocsPlus } from '@icons'
import { useStore, useAuthStore } from '@stores'
import TabLayout from '@components/pages/TabLayout'
import { useMemo } from 'react'
import Loading from '@components/ui/Loading'
import { LuLogIn } from 'react-icons/lu'

const SignInPanel = dynamic(() => import('@pages/panels/SignInPanel'), {
  loading: () => <Loading />
})
const DocumentsPanel = dynamic(() => import('@pages/panels/DocumentsPanel'), {
  loading: () => <Loading />
})
const ProfilePanel = dynamic(() => import('@pages/panels/profile/ProfilePanel'), {
  loading: () => <Loading />
})

function Home({ hostname }: { hostname: string }) {
  const user = useAuthStore((state) => state.profile)
  const authLoading = useAuthStore((state) => state.loading)
  const displayName = useAuthStore((state) => state.displayName)
  const { isAuthServiceAvailable } = useStore((state) => state.settings)

  const isUserSignedIn = useMemo(
    () => user && isAuthServiceAvailable,
    [user, isAuthServiceAvailable]
  )

  if (authLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="max-w-5xl w-full flex items-center justify-center rounded-md relative">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    )
  }

  return (
    <>
      <HeadSeo />
      <div className="w-full h-full flex items-center justify-center bg-slate-100 p-4">
        <Tabs defaultActiveTab="deck" className="max-w-5xl rounded-md relative">
          <TabList
            className={`${
              isAuthServiceAvailable ? 'flex' : 'hidden'
            } bg-slate-200 rounded-t-md relative drop-shadow-md z-0 -bottom-1 `}>
            <Tab name="deck" className="flex items-center ">
              <div className="tooltip tooltip-top" data-tip="docs.plus">
                <DocsPlus size={26} />
              </div>
            </Tab>
            {isUserSignedIn && <Tab name="documents">Documents</Tab>}
            {isAuthServiceAvailable && !user && (
              <Tab name="sign-in" className="ml-auto flex items-center">
                <div className="tooltip tooltip-top" data-tip="Sign in">
                  <LuLogIn size={22} />
                </div>
              </Tab>
            )}
            {isUserSignedIn && (
              <Tab name="profile" className="ml-auto py-2">
                <Avatar
                  src={user?.avatar_url}
                  id={user?.id}
                  alt={displayName}
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
    </>
  )
}

export default Home

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { hostname: context.req?.headers?.host }
  }
}
