import { GetServerSidePropsContext } from 'next'
import MobileDetect from 'mobile-detect'
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

const DashboardLayout = dynamic(() => import('@pages/document/layouts/DashboardLayout'))

const SignInPanel = dynamic(() => import('@pages/panels/SignInPanel'), {
  loading: () => <Loading />
})
const DocumentsPanel = dynamic(() => import('@pages/panels/DocumentsPanel'), {
  loading: () => <Loading />
})
const ProfilePanel = dynamic(() => import('@pages/panels/profile/ProfilePanel'), {
  loading: () => <Loading />
})

const MobileView = ({ hostname }: { hostname: string }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="flex flex-wrap rounded-md bg-white p-2 pb-2 shadow-md sm:m-auto sm:justify-center sm:p-6 sm:py-6 sm:pb-2">
        <DashboardLayout>
          <DeckPanel hostname={hostname} />
        </DashboardLayout>
      </div>
    </div>
  )
}

function Home({ hostname, isMobile }: { hostname: string; isMobile: boolean }) {
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
      <div className="flex size-full items-center justify-center">
        <div className="relative flex w-full max-w-5xl items-center justify-center rounded-md">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    )
  }

  if (isMobile) return <MobileView hostname={hostname} />

  return (
    <>
      <HeadSeo />
      <div className="flex size-auto justify-center overflow-auto bg-slate-100 p-4 sm:size-full sm:items-center">
        <Tabs defaultActiveTab="deck" className="relative max-w-5xl rounded-md">
          <TabList
            className={`${
              isAuthServiceAvailable ? 'flex' : 'hidden'
            } relative -bottom-1 z-0 rounded-t-md bg-slate-200 drop-shadow-md`}>
            <Tab name="deck" className="flex items-center">
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
                  className="size-10 rounded-full border drop-shadow"
                />
              </Tab>
            )}
          </TabList>
          <TabPanels className="relative z-10 max-w-5xl rounded-md bg-white shadow">
            <TabLayout name="deck">
              <DeckPanel hostname={hostname} />
            </TabLayout>
            {isUserSignedIn && (
              <TabLayout name="documents">
                <DocumentsPanel />
              </TabLayout>
            )}
            {isAuthServiceAvailable && !user && (
              <TabLayout name="sign-in" footer={false} className="w-full p-6 sm:w-[28rem] sm:p-6">
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
  const userAgent = context.req.headers['user-agent']
  const device = new MobileDetect(userAgent || '')

  return {
    props: {
      hostname: context.req?.headers?.host || '',
      isMobile: device.mobile() ? true : false
    }
  }
}
