import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import {
  Avatar,
  useAvatar,
  AVATAR_URL_CHANNEL_NAME,
} from '../../../../components/Avatar'
import {
  Camera,
  Spinner,
  LinkAlt,
  Facebook,
  Twitter,
  At,
  CircleUser,
} from '../../../../components/icons/Icons'
import InputOverlapLabel from '../../../../components/InputOverlapLabel'
import TextAreaOvelapLabel from '../../../../components/TextAreaOvelapLabel'
import Button from '../../../../components/Button'
import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'
import PubSub from 'pubsub-js'

import toast, { Toaster } from 'react-hot-toast'

// Defined constants
const AVATARS = 'avatars'
const PROFILES = 'profiles'
const PUBLIC = 'public'

const AvatarUploader = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()
  const { setAvatarUrl, updateAvatarURL } = useAvatar()
  const fileInputRef = useRef()
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (event) => {
    const avatarFile = event.target.files[0]
    setUploading(true)
    if (!avatarFile) return
    const { data, error } = await supabaseClient.storage
      .from(AVATARS)
      .upload(`${PUBLIC}/${user.id}.png`, avatarFile, {
        cacheControl: '0',
        upsert: true,
      })

    if (error) {
      toast.error('Error uploading avatar, please try again.')
      setUploading(false)
      return
    }

    const bucketAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${user.id}.png`

    // updateAvatarURL((e) => {
    //   return `${bucketAddress}?${Date.now().toString()}`
    // })

    PubSub.publish(
      AVATAR_URL_CHANNEL_NAME,
      `${bucketAddress}?${Date.now().toString()}`
    )

    const { data: savedAvatard, error: savedAvatarError } = await supabaseClient
      .from(PROFILES)
      .update({ avatar_url: bucketAddress })
      .eq('id', user.id)

    toast.success('Avatar uploaded successfully!')
    // window.location.reload()
    setUploading(false)
  }

  const handleClick = () => {
    fileInputRef.current.click()
  }

  return (
    <div
      className="avatar-uploader mt-4 w-32 h-32 relative rounded-xl border drop-shadow-sm overflow-hidden"
      onClick={handleClick}>
      <div
        className={` ${
          !uploading ? 'hover:opacity-50 opacity-0' : 'opacity-80 bg-white'
        } absolute w-full h-full transition-opacity cursor-pointer bg-black flex items-center justify-center`}>
        {!uploading ? <Camera size={24} fill="#fff" /> : <Spinner />}
      </div>
      <Avatar height={32} width={32} className="w-32 h-32" />
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}

const AccountInformation = ({
  fullName,
  setFullName,
  userName,
  setUserName,
}) => {
  return (
    <div className="flex flex-col">
      <InputOverlapLabel
        Icon={At}
        size={17}
        label="Full Name"
        className="mt-4"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <InputOverlapLabel
        Icon={CircleUser}
        label="Username"
        className="mt-4"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
      />
    </div>
  )
}

const About = ({ bio, setBio, company, setCompany, jobTitle, setJobTitle }) => {
  return (
    <div className="flex flex-col">
      <TextAreaOvelapLabel
        label="About"
        className="mt-4"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />
      <InputOverlapLabel
        label="Company"
        className="mt-4"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />
      <InputOverlapLabel
        label="Job Title"
        className="mt-4"
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
      />
    </div>
  )
}

const SocialLinks = ({
  twitter,
  setTwitter,
  facebook,
  setFacebook,
  website,
  setWebsite,
}) => {
  const [twitterError, setTwitterError] = useState('')
  const [facebookError, setFacebookError] = useState('')
  const [websiteError, setWebsiteError] = useState('')

  const validateWebsite = (url) => {
    const urlRegex =
      /^((http|https):\/\/)?(www.)?[a-z0-9]+\.[a-z]+(\/[a-zA-Z0-9#]+\/?)*$/
    if (!urlRegex.test(url)) {
      setWebsiteError('Invalid URL format!')
    } else {
      setWebsiteError('')
    }
  }

  const validateTwitter = (username) => {
    const usernameRegex = /^@?(\w){1,15}$/
    if (!usernameRegex.test(username)) {
      setTwitterError(
        "Invalid Twitter handle. It must be 15 characters or less and can't contain special characters except '_'."
      )
    } else {
      setTwitterError('')
    }
  }

  const validateFacebook = (username) => {
    const usernameRegex = /^[a-z\d.]{5,}$/i
    if (!usernameRegex.test(username)) {
      setFacebookError(
        'Invalid Facebook username. It must be 5 characters or more and can contain alphabets, numbers and periods.'
      )
    } else {
      setFacebookError('')
    }
  }

  const handleTwitterChange = (e) => {
    const username = e.target.value
    setTwitter(username)
    validateTwitter(username)
  }

  const handleFacebookChange = (e) => {
    const username = e.target.value
    setFacebook(username)
    validateFacebook(username)
  }

  const handleWebsiteChange = (e) => {
    const url = e.target.value
    setWebsite(url)
    validateWebsite(url)
  }

  return (
    <div className="flex flex-col">
      <InputOverlapLabel
        Icon={Twitter}
        label="Twitter"
        className={`mt-4 ${twitterError ? ' border-red-500' : ''}`}
        value={twitter}
        onChange={handleTwitterChange}
      />
      {twitterError && (
        <p className="text-red-500 text-xs mt-2 font-semibold">
          {twitterError}
        </p>
      )}
      <InputOverlapLabel
        Icon={Facebook}
        label="Facebook"
        className={`mt-4 ${facebookError ? ' border-red-500' : ''}`}
        value={facebook}
        onChange={handleFacebookChange}
      />
      {facebookError && (
        <p className="text-red-500 text-xs mt-2 font-semibold">
          {facebookError}
        </p>
      )}
      <InputOverlapLabel
        Icon={LinkAlt}
        label="Website"
        className={`mt-4 ${websiteError ? ' border-red-500' : ''}`}
        value={website}
        onChange={handleWebsiteChange}
      />
      {websiteError && (
        <p className="text-red-500 text-xs mt-2 font-semibold">
          {websiteError}
        </p>
      )}
    </div>
  )
}

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

  const handleSave = async () => {
    setLoading(true)
    const updatedUser = {}
    if (userName) updatedUser.userName = userName

    const { data, error } = await supabaseClient
      .from('profiles')
      .update({
        full_name: fullName,
        about: bio,
        company,
        job_title: jobTitle,
        twitter,
        facebook,
        website,
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
          <AvatarUploader
            fullName={fullName}
            setFullName={setFullName}
            userName={userName}
            setUserName={setUserName}
          />
        </TabSection>
        <TabSection name="Account Information">
          <AccountInformation
            fullName={fullName}
            setFullName={setFullName}
            userName={userName}
            setUserName={setUserName}
          />
        </TabSection>
        <TabSection name="About">
          <About
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
          <SocialLinks
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
        <Button
          className="!w-32 mr-8 text-sm !p-2"
          loading={loading}
          onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  )
}

export default ProfileTab
