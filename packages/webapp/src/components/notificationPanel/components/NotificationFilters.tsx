import { TabList } from '@components/ui/Tabs'
import { useStore } from '@stores'
import { TTab } from '@types'

const NotificationFilters = () => {
  const { notificationTabs, notificationActiveTab, setNotificationActiveTab } = useStore(
    (state) => state
  )

  return (
    <TabList
      className=""
      tabs={notificationTabs}
      activeTab={notificationActiveTab}
      onTabChange={(tab) => setNotificationActiveTab(tab as TTab)}
    />
  )
}

export default NotificationFilters
