import React, { useState, useCallback } from 'react'
import Button from '../../../ui/Button'
import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'
import toast from 'react-hot-toast'
import AvatarSection from './sections/AvatarSection'
import AccountInfoSection from './sections/AccountInfoSection'
import AboutSection from './sections/AboutSection'
import SocialLinksSection from './sections/SocialLinksSection'
import { useAuthStore } from '@stores'
import { getSimilarUsername, updateUser } from '@api'

const ProfileTab = () => {
  const user = useAuthStore((state) => state.profile)
  const displayName = useAuthStore((state) => state.displayName)

  const [loading, setLoading] = useState(false)

  const checkUsername = useCallback(async (username: string | undefined) => {
    if (!username) return false

    if (username && username.length < 4 && username.indexOf(' ') >= 0) {
      toast.error('Username must be at least 3 characters long and must not contain spaces.')
      return false
    }

    const { data, error } = await getSimilarUsername(username)

    if (error || !data) {
      console.error(error)
      toast.error('Error fetching user profile')
      return false
    }

    if (data.length > 0) {
      toast.error('Username already taken')
      return false
    }
    return true
  }, [])

  const handleSave = async () => {
    setLoading(true)
    const updatedUser = {}

    if (user?.username !== user?.username) {
      const isUsernameValid = await checkUsername(user?.username)

      if (!isUsernameValid) {
        setLoading(false)
        toast.error('Username already taken')
        return
      }
    }

    if (!user?.id) return
    const { data, error } = await updateUser(user?.id, user)

    if (error) {
      console.error(error)
      toast.error('Error updating profile!' + error.message)
    } else {
      toast.success('Profile updated successfully!')
    }

    // TODO: check if the user data broadcast to other user or not!
    // Save the new user data, then broadcast changes to the current document user

    setLoading(false)
  }

  return (
    <div className="border-l h-full relative  ">
      <TabTitle className="">Profile</TabTitle>

      <div className="h-[30rem] overflow-y-auto relative">
        <TabSection
          name="Profile Picture"
          description="Upload a picture to make your profile stand out and let people recognize your comments and contributions easily!">
          <AvatarSection />
        </TabSection>
        <TabSection name="Account Information">
          <AccountInfoSection />
        </TabSection>
        <TabSection name="About">
          <AboutSection />
        </TabSection>
        <TabSection
          name="Profile Social Links"
          description="Add your social media profiles so others can connect with you and you can grow your network!">
          <SocialLinksSection />
        </TabSection>
      </div>
      <div className="sticky bottom-0 flex flex-row-reverse border-t pt-4 bg-white z-10">
        <Button className="!w-40 btn-primary text-white " loading={loading} onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  )
}

export default ProfileTab
