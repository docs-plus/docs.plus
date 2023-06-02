import React, { useRef, useState, useEffect, useCallback, use } from 'react'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { debounce } from 'lodash'
import Button from '../../../../components/Button'
import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'

import toast from 'react-hot-toast'

import AvatarSection from './sections/AvatarSection'
import AccountInfoSection from './sections/AccountInfoSection'
import AboutSection from './sections/AboutSection'
import SocialLinksSection from './sections/SocialLinksSection'

// Defined constants
const PROFILES = 'profiles'

const ProfileTab = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()

  const [fullName, setFullName] = useState(user.user_metadata.full_name || '')
  const [userName, setUserName] = useState(user.user_metadata.username || '')

  const [bio, setBio] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  const [twitter, setTwitter] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')

  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select()
        .eq('id', user.id)
        .single()

      if (error) {
        console.error(error)
        toast.error('Error fetching your profile' + error.message)
      } else {
        setProfileData(data)
        setFullName(data.full_name || '')
        setUserName(data.username || '')
        setBio(data.about || '')
        setCompany(data.company || '')
        setJobTitle(data.job_title || '')
        setTwitter(data.twitter || '')
        setFacebook(data.facebook || '')
        setWebsite(data.website || '')
      }
    }
    fetchProfile()
  }, [])

  const checkUserName = useCallback(
    debounce(
      async userName => {
        if (userName.length < 4) {
          return false
        }

        // check usename must not contain spaces
        if (userName.indexOf(' ') >= 0) {
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
          toast.error('Username already taken')
          return false
        }
        return true
      },
      650,
      { leading: false, trailing: true }
    ),
    [supabaseClient] // dependencies
  )

  const handleSave = async () => {
    setLoading(true)
    const updatedUser = {}

    if (userName && userName !== profileData.username) {
      const isUsernameValid = await checkUserName(userName)
      if (isUsernameValid) {
        updatedUser.userName = userName
      } else {
        setLoading(false)
        toast.error('Username already taken')
        return
      }
    }

    const { data, error } = await supabaseClient
      .from('profiles')
      .update({
        full_name: fullName,
        about: bio,
        company,
        job_title: jobTitle,
        twitter,
        facebook,
        website
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
            profileData={profileData}
            fullName={fullName}
            setFullName={setFullName}
            userName={userName}
            setUserName={setUserName}
          />
        </TabSection>
        <TabSection name="Account Information">
          <AccountInfoSection
            profileData={profileData}
            fullName={fullName}
            setFullName={setFullName}
            userName={userName}
            setUserName={setUserName}
          />
        </TabSection>
        <TabSection name="About">
          <AboutSection
            profileData={profileData}
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
