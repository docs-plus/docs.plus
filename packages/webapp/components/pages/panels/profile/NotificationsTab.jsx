import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'
import Toggle from '../../../Toggle'
import Checkbox from '../../../Checkbox'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import useProfileData from '@hooks/useProfileData'

const ToggleSection = ({ name, description, value, checked, onChange }) => {
  return (
    <div className="flex flex-col p-4 antialiased ">
      <p className="text-lg font-bold">{name}</p>
      <div className="flex flex-row align-middle items-center">
        <p className="text-gray-400 text-base">{description}</p>
        <div className="border-l flex-col h-full py-4 px-2 ml-2">
          <Toggle id={value} checked={checked} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

const NotificationsTab = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()
  const { profileData, profileFetchingError, loadingProfileData } = useProfileData()

  const [pushNotifications, setPushNotifications] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(false)
  const [notificationNewActivity, setNotificationNewActivity] = useState(false)

  useEffect(() => {
    if (profileFetchingError) {
      console.error(profileFetchingError)
      toast.error('Error fetching your profile' + profileFetchingError.message)
    }
    if (!loadingProfileData && profileData) {
      setPushNotifications(profileData.push_notifications)
      setEmailNotifications(profileData.email_notifications)
      setNotificationNewActivity(profileData.email_notification_new_activity)
    }
  }, [loadingProfileData, profileData, profileFetchingError])

  const changePushNotifications = async (e) => {
    setPushNotifications(e.target.checked)

    const { error } = await supabaseClient
      .from('profiles')
      .update({ push_notifications: e.target.checked })
      .eq('id', user.id)
      .single()

    if (error) {
      console.error(error)
      toast.error('Error updating your profile' + error.message)
    }
    toast.success('Profile updated')
  }
  const changeEmailNotifications = async (e) => {
    setEmailNotifications(e.target.checked)

    const { error } = await supabaseClient
      .from('profiles')
      .update({ email_notifications: e.target.checked })
      .eq('id', user.id)
      .single()

    if (error) {
      console.error(error)
      toast.error('Error updating your profile' + error.message)
    }
    toast.success('Profile updated')
  }

  const changeNotificationNewActivity = async (e) => {
    setNotificationNewActivity(e.target.checked)

    const { error } = await supabaseClient
      .from('profiles')
      .update({ email_notification_new_activity: e.target.checked })
      .eq('id', user.id)
      .single()

    if (error) {
      console.error(error)
      toast.error('Error updating your profile' + error.message)
    }
    toast.success('Profile updated')
  }

  return (
    <div className="border-l h-full">
      <TabTitle>Notifications</TabTitle>
      {loadingProfileData && <div className="p-4">Loading...</div>}

      {!loadingProfileData && (
        <>
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

          <TabSection name="Send me emails for:" className={`${emailNotifications ? 'flex' : 'hidden'}`}>
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
        </>
      )}
    </div>
  )
}

export default NotificationsTab