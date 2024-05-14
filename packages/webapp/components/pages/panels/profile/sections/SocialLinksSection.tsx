import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import React, { useState } from 'react'
import { LinkAlt, Facebook, Twitter } from '@icons'
import { useAuthStore } from '@stores'

const SocialLinksSection = () => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)

  const [twitterError, setTwitterError] = useState<string | null>(null)
  const [facebookError, setFacebookError] = useState<string | null>(null)
  const [websiteError, setWebsiteError] = useState<string | null>(null)

  const validateWebsite = (url: string) => {
    if (url === '') return setWebsiteError(null) // If empty, don't show error
    const urlRegex = /^((http|https):\/\/)?(www.)?[a-z0-9]+\.[a-z]+(\/[a-zA-Z0-9#]+\/?)*$/
    if (!urlRegex.test(url)) {
      setWebsiteError('Invalid URL format!')
    } else {
      setWebsiteError(null)
    }
  }

  const validateTwitter = (username: string) => {
    if (username === '') return setTwitterError(null) // If empty, don't show error
    const usernameRegex = /^@?(\w){1,15}$/
    if (!usernameRegex.test(username)) {
      setTwitterError(
        "Invalid Twitter handle. It must be 15 characters or less and can't contain special characters except '_'."
      )
    } else {
      setTwitterError(null)
    }
  }

  const validateFacebook = (username: string) => {
    if (username === '') return setFacebookError(null) // If empty, don't show error
    const usernameRegex = /^[a-z\d.]{5,}$/i
    if (!usernameRegex.test(username)) {
      setFacebookError(
        'Invalid Facebook username. It must be 5 characters or more and can contain alphabets, numbers and periods.'
      )
    } else {
      setFacebookError(null)
    }
  }

  const handleTwitterChange = (e: any) => {
    if (!user) return
    const username = e.target.value
    if (!twitterError) setProfile({ ...user, twitter: username })
    validateTwitter(username)
  }

  const handleFacebookChange = (e: any) => {
    if (!user) return
    const username = e.target.value
    if (!facebookError) setProfile({ ...user, facebook: username })
    validateFacebook(username)
  }

  const handleWebsiteChange = (e: any) => {
    if (!user) return
    const url = e.target.value
    if (!websiteError) setProfile({ ...user, website: url })
    validateWebsite(url)
  }

  return (
    <div className="flex flex-col">
      <InputOverlapLabel
        Icon={Twitter}
        label="Twitter"
        className={`mt-4 ${twitterError ? ' border-red-500' : ''}`}
        value={user?.twitter}
        onChange={handleTwitterChange}
      />
      {twitterError && <p className="mt-2 text-xs font-semibold text-red-500">{twitterError}</p>}
      <InputOverlapLabel
        Icon={Facebook}
        label="Facebook"
        className={`mt-4 ${facebookError ? ' border-red-500' : ''}`}
        value={user?.facebook}
        onChange={handleFacebookChange}
      />
      {facebookError && <p className="mt-2 text-xs font-semibold text-red-500">{facebookError}</p>}
      <InputOverlapLabel
        Icon={LinkAlt}
        label="Website"
        className={`mt-4 ${websiteError ? ' border-red-500' : ''}`}
        value={user?.website}
        onChange={handleWebsiteChange}
      />
      {websiteError && <p className="mt-2 text-xs font-semibold text-red-500">{websiteError}</p>}
    </div>
  )
}

export default SocialLinksSection
