import InputOverlapLabel from '../../../../InputOverlapLabel'
import React, { useState } from 'react'
import { LinkAlt, Facebook, Twitter } from '@icons'

const SocialLinksSection = ({ twitter, setTwitter, facebook, setFacebook, website, setWebsite }) => {
  const [twitterError, setTwitterError] = useState('')
  const [facebookError, setFacebookError] = useState('')
  const [websiteError, setWebsiteError] = useState('')

  const validateWebsite = (url) => {
    if (url === '') return setWebsiteError('') // If empty, don't show error
    const urlRegex = /^((http|https):\/\/)?(www.)?[a-z0-9]+\.[a-z]+(\/[a-zA-Z0-9#]+\/?)*$/
    if (!urlRegex.test(url)) {
      setWebsiteError('Invalid URL format!')
    } else {
      setWebsiteError('')
    }
  }

  const validateTwitter = (username) => {
    if (username === '') return setTwitterError('') // If empty, don't show error
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
    if (username === '') return setFacebookError('') // If empty, don't show error
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
      {twitterError && <p className="text-red-500 text-xs mt-2 font-semibold">{twitterError}</p>}
      <InputOverlapLabel
        Icon={Facebook}
        label="Facebook"
        className={`mt-4 ${facebookError ? ' border-red-500' : ''}`}
        value={facebook}
        onChange={handleFacebookChange}
      />
      {facebookError && <p className="text-red-500 text-xs mt-2 font-semibold">{facebookError}</p>}
      <InputOverlapLabel
        Icon={LinkAlt}
        label="Website"
        className={`mt-4 ${websiteError ? ' border-red-500' : ''}`}
        value={website}
        onChange={handleWebsiteChange}
      />
      {websiteError && <p className="text-red-500 text-xs mt-2 font-semibold">{websiteError}</p>}
    </div>
  )
}

export default SocialLinksSection
