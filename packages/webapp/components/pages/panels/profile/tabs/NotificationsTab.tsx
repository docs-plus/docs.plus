import TabTitle from '../components/TabTitle'
import TabSection from '../components/TabSection'
import Toggle from '../../../../ui/Toggle'
import Checkbox from '../../../../ui/Checkbox'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@stores'

const ToggleSection = ({ name, description, value, checked, onChange }: any) => {
  return (
    <div className="flex flex-col p-4 antialiased">
      <p className="text-lg font-bold">{name}</p>
      <div className="flex flex-row items-center align-middle">
        <p className="text-base text-gray-400">{description}</p>
        <div className="ml-2 h-full flex-col border-l px-2 py-4">
          <Toggle id={value} checked={checked} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

const NotificationsTab = ({ goBack }: any) => {
  const user = useAuthStore((state) => state.profile)

  const [pushNotifications, setPushNotifications] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(false)
  const [notificationNewActivity, setNotificationNewActivity] = useState(false)

  const changePushNotifications = async (e: any) => {
    // setPushNotifications(e.target.checked)

    // const { error } = await supabaseClient
    //   .from('profiles')
    //   .update({ push_notifications: e.target.checked })
    //   .eq('id', user.id)
    //   .single()

    // if (error) {
    //   console.error(error)
    //   toast.error('Error updating your profile' + error.message)
    // }
    // toast.success('Profile updated')
    toast.error('This feature is temporarily unavailable.')
  }
  const changeEmailNotifications = async (e: any) => {
    // setEmailNotifications(e.target.checked)

    // const { error } = await supabaseClient
    //   .from('profiles')
    //   .update({ email_notifications: e.target.checked })
    //   .eq('id', user.id)
    //   .single()

    // if (error) {
    //   console.error(error)
    //   toast.error('Error updating your profile' + error.message)
    // }
    // toast.success('Profile updated')
    // display toast and say this feature currenlty disabled
    toast.error('This feature is temporarily unavailable.')
  }

  const changeNotificationNewActivity = async (e: any) => {
    // setNotificationNewActivity(e.target.checked)

    // const { error } = await supabaseClient
    //   .from('profiles')
    //   .update({ email_notification_new_activity: e.target.checked })
    //   .eq('id', user.id)
    //   .single()

    // if (error) {
    //   console.error(error)
    //   toast.error('Error updating your profile' + error.message)
    // }
    // toast.success('Profile updated')
    toast.error('This feature is temporarily unavailable.')
  }

  return (
    <div className="relative h-full md:border-l">
      <TabTitle goBack={goBack} title="Notifications"></TabTitle>

      <ToggleSection
        value="pushNotifications"
        checked={pushNotifications}
        onChange={changePushNotifications}
        name="Push notifications"
        description="The dcos.plus notification system notifies you of important events such as replies, mentions, updates, etc."
      />

      <ToggleSection
        value="emailNotifications"
        checked={emailNotifications}
        onChange={changeEmailNotifications}
        name="Email notifications"
        description="Receive notifications via email so you never miss a mention, reply, upvote or comment on docs.plus"
      />

      <TabSection
        name="Send me emails for:"
        className={`${emailNotifications ? 'flex' : 'hidden'}`}>
        <Checkbox
          className="mt-2"
          label="New activity notifications (mentions, replies, etc.)"
          onChange={changeNotificationNewActivity}
          checked={notificationNewActivity}
        />
        <Checkbox
          className="mt-2"
          label="Email me System notifications (security related, always on)"
          disabled={true}
          checked={true}
        />
      </TabSection>
    </div>
  )
}

export default NotificationsTab
