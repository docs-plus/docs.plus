import React, { useState, useEffect, useCallback } from 'react'
import Button from '../../../ui/Button'
import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'
import toast from 'react-hot-toast'
import AvatarSection from './sections/AvatarSection'
import AccountInfoSection from './sections/AccountInfoSection'
import AboutSection from './sections/AboutSection'
import SocialLinksSection from './sections/SocialLinksSection'
import { supabaseClient } from '@utils/supabase'
import { useAuthStore } from '@stores'

// Defined constants
const PROFILES = 'profiles'

const ProfileTab = () => {
  const user = useAuthStore((state) => state.profile)
  const displayName = useAuthStore((state) => state.displayName)

  const [fullName, setFullName] = useState(displayName || '')
  const [userName, setUserName] = useState(user.username || displayName || '')

  const [bio, setBio] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  const [twitter, setTwitter] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
      setUserName(user.username || '')
      setBio(user.about || '')
      setCompany(user.company || '')
      setJobTitle(user.job_title || '')
      setTwitter(user.twitter || '')
      setFacebook(user.facebook || '')
      setWebsite(user.website || '')
    }
  }, [user])

  const checkUserName = useCallback(async (userName) => {
    if (userName && userName.length < 4 && userName.indexOf(' ') >= 0) {
      toast.error('Username must be at least 3 characters long and must not contain spaces.')
      return false
    }

    const { data, error } = await supabaseClient
      .from(PROFILES)
      .select('username')
      .eq('username', userName)

    if (error) {
      console.error(error)
      toast.error('Error fetching user profile')
      return false
    }

    if (data.length > 0) {
      toast.error('Username already taken=?', data.length)
      return false
    }
    return true
  }, [])

  const handleSave = async () => {
    setLoading(true)
    const updatedUser = {}

    if (userName && userName !== profileData?.username) {
      const isUsernameValid = await checkUserName(userName)
      if (isUsernameValid) {
        updatedUser.username = userName
      } else {
        setLoading(false)
        toast.error('Username already taken')
        return
      }
    }

    const { error } = await supabaseClient
      .from('profiles')
      .update({
        full_name: fullName,
        about: bio,
        company,
        job_title: jobTitle,
        twitter,
        facebook,
        website,
        ...updatedUser
      })
      .eq('id', user.id)

    if (error) {
      console.error(error)
      toast.error('Error updating profile!' + error.message)
    } else {
      toast.success('Profile updated successfully!')
    }

    setLoading(false)
  }

  return (
    <div className="border-l h-full relative  ">
      <TabTitle className="">Profile</TabTitle>

      <div className="h-[30rem] overflow-y-auto relative">
        <TabSection
          name="Profile Picture"
          description="Upload a picture to make your profile stand out and let people recognize your comments and contributions easily!">
          <AvatarSection
            profileData={user}
            fullName={fullName}
            setFullName={setFullName}
            userName={userName}
            setUserName={setUserName}
          />
        </TabSection>
        <TabSection name="Account Information">
          <AccountInfoSection
            profileData={user}
            fullName={fullName}
            setFullName={setFullName}
            userName={userName}
            setUserName={setUserName}
          />
        </TabSection>
        <TabSection name="About">
          <AboutSection
            profileData={user}
            bio={bio}
            setBio={setBio}
            company={company}
            setCompany={setCompany}
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
          />
        </TabSection>
        <TabSection
          name="Profile Social Links"
          description="Add your social media profiles so others can connect with you and you can grow your network!">
          <SocialLinksSection
            profileData={user}
            twitter={twitter}
            setTwitter={setTwitter}
            facebook={facebook}
            setFacebook={setFacebook}
            website={website}
            setWebsite={setWebsite}
          />
        </TabSection>
      </div>
      <div className="sticky bottom-0 flex flex-row-reverse border-t pt-4 bg-white z-10">
        <Button className="!w-32 mr-8 text-sm !p-2" loading={loading} onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  )
}

export default ProfileTab
