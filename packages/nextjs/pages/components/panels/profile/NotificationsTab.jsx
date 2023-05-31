import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'

const NotificationsTab = () => {
  return (
    <div className="border-l h-full">
      <TabTitle>Notifications</TabTitle>
      <TabSection
        name="Push notifications"
        description="The dcos.plus notification system notifies you of important events such as replies, mentions, updates, etc."></TabSection>
      <TabSection
        name="Email notifications"
        description="Receive notifications via email so you never miss a mention, reply, upvote or comment on docs.plus"></TabSection>
      <TabSection name="Send me emails for:"></TabSection>
    </div>
  )
}

export default NotificationsTab
