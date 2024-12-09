import { useState } from 'react'
import dynamic from 'next/dynamic'
import Loading from '@components/ui/Loading'
import LinksMenu from './components/LinksMenu'
import SignOutButton from './components/SignOutButton'
import TabsMenu from './components/TabsMenu'

const ProfileTab = dynamic(() => import('./tabs/ProfileTab'), {
  loading: () => <Loading className="size-56" />
})
const DocumentsPanel = dynamic(() => import('./tabs/DocumentsTab'), {
  loading: () => <Loading className="size-56" />
})
const SecurityTab = dynamic(() => import('./tabs/SecurityTab'), {
  loading: () => <Loading className="size-56" />
})
const NotificationsTab = dynamic(() => import('./tabs/NotificationsTab'), {
  loading: () => <Loading className="size-56" />
})

const ProfilePanel = () => {
  const [activeTab, setActiveTab] = useState('profile')
  const [isPanelVisible, setIsPanelVisible] = useState(false)

  const changeTab = (tab: string) => {
    setActiveTab(tab)
    setIsPanelVisible(true)
  }

  const goBack = () => {
    setIsPanelVisible(false)
  }

  return (
    <>
      <div
        className={`relative h-full w-full flex-col overflow-auto p-4 px-6 md:w-4/12 ${isPanelVisible ? 'hidden md:flex' : 'flex'}`}>
        <TabsMenu activeTab={activeTab} changeTab={changeTab} />
        <div className="divider"></div>
        <LinksMenu />
        <SignOutButton />
      </div>
      <div
        className={`relative w-full overflow-y-auto bg-base-100 p-4 pt-1 md:flex md:w-8/12 ${
          isPanelVisible ? 'flex' : 'hidden'
        }`}>
        {activeTab === 'profile' && <ProfileTab goBack={goBack} />}
        {activeTab === 'documents' && <DocumentsPanel goBack={goBack} />}
        {activeTab === 'security' && <SecurityTab goBack={goBack} />}
        {activeTab === 'notifications' && <NotificationsTab goBack={goBack} />}
      </div>
    </>
  )
}

export default ProfilePanel
