import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'
import Toggle from '../../../../components/Toggle'
import Checkbox from '../../../../components/Checkbox'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'

const ToggleSection = ({ name, description, value, checked, onChange, children }) => {
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

  const [pushNotifications, setPushNotifications] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(false)
  const [loadingProfileData, setLoadingProfileData] = useState(false)
  const [profileData, setProfileData] = useState(null)

  useEffect(() => {
    setLoadingProfileData(true)
    const fetchProfile = async () => {
      const { data, error } = await supabaseClient.from('profiles').select().eq('id', user.id).single()

      if (error) {
        console.error(error)
        toast.error('Error fetching your profile' + error.message)
      } else {
        setProfileData(data)
        setLoadingProfileData(false)
      }
    }
    fetchProfile()
  }, [])

  const changePushNotifications = (e) => {
    console.log(e.target.checked)
    setPushNotifications(e.target.checked)
  }
  const changeEmailNotifications = (e) => {
    console.log(e.target.checked)
    setEmailNotifications(e.target.checked)
  }

  if (loadingProfileData) return <div className="p-4">Loading...</div>

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
            <Checkbox className="mt-2" label="New activity notifications (mentions, replies, etc.)" />
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
