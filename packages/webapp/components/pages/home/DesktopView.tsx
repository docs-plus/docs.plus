import TabLayout from '../TabLayout'
import DeckPanel from '../panels/DeckPanel'
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@components/ui/Tabs/Tabs'
import { LuLogIn } from 'react-icons/lu'
import { Avatar } from '@components/ui/Avatar'
import { DocsPlus } from '@components/icons/Icons'
import HeadSeo from '@components/HeadSeo'
import { User } from '@supabase/supabase-js'
import { useAuthStore, useStore } from '@stores'
import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import Loading from '@components/ui/Loading'
import { Footer } from '@components/pages/document/layouts/DashboardLayout'
const SignInPanel = dynamic(() => import('@pages/panels/SignInPanel'), {
  loading: () => <Loading />
})
const ProfilePanel = dynamic(() => import('@pages/panels/profile/ProfilePanel'), {
  loading: () => <Loading />
})

const DesktopView = ({ hostname }: { hostname: string }) => {
  const user = useAuthStore((state) => state.profile)
  const { isAuthServiceAvailable } = useStore((state) => state.settings)

  const isUserSignedIn = useMemo(
    () => user && isAuthServiceAvailable,
    [user, isAuthServiceAvailable]
  )

  return (
    <>
      <HeadSeo />
      <div className="flex h-full w-full flex-col items-center justify-center overflow-auto bg-slate-100 p-4">
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
                  avatarUpdatedAt={user?.avatar_updated_at}
                  id={user?.id}
                  alt={user?.display_name}
                  clickable={false}
                  className="size-10 rounded-full border drop-shadow"
                />
              </Tab>
            )}
          </TabList>
          <TabPanels className="relative z-10 max-w-5xl rounded-md bg-white shadow">
            <TabLayout name="deck">
              <DeckPanel hostname={hostname} />
            </TabLayout>
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

export default DesktopView
