import { useState, useEffect, useCallback } from 'react'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useMutation } from '@tanstack/react-query'
import { Envelope, AngleSmallLeft, Sparkles } from '@icons'
import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'
import InputOverlapLabel from '../../../InputOverlapLabel'
import Button from '../../../Button'
import toast from 'react-hot-toast'
import useEmail from '@hooks/useEmail'
import useProfileData from '@hooks/useProfileData'

const ChangeEmailSection = ({ email, emailError, handleEmailChange, saveNewEmail, loading, setLoading }) => (
  <div className="border-l h-full">
    <TabTitle className="flex">
      <button
        className="rounded-md w-7 h-7 flex items-center justify-center mr-4 hover:bg-slate-200 transition-all"
        onClick={() => setLoading(false)}>
        <AngleSmallLeft size={24} className="" />
      </button>
      Change email
    </TabTitle>
    <TabSection>
      <div className="flex flex-col">
        <InputOverlapLabel
          Icon={Envelope}
          size={18}
          label="Email"
          className={`mt-4 ${emailError ? ' border-red-500' : ''}`}
          value={email}
          onChange={handleEmailChange}
        />
        {emailError}
        {emailError && <p className="text-red-500 text-xs mt-2 font-semibold">{emailError}</p>}
      </div>
      <Button className="mt-6 w-40" onClick={saveNewEmail} loading={loading}>
        Save changes
      </Button>
    </TabSection>
  </div>
)

const SecuritySection = ({ email, profileData, loading, acceptNewEmail, setLoading }) => (
  <div className="border-l h-full">
    <TabTitle>Security</TabTitle>
    <TabSection name="Account email" description="The email address associated with your docs.plus account">
      <div className="flex flex-col">
        <InputOverlapLabel
          Icon={Envelope}
          size={18}
          label={acceptNewEmail ? 'Old Email' : 'Email'}
          className="mt-4"
          value={email}
          disabled={true}
        />
      </div>
      {!acceptNewEmail && (
        <Button className="mt-6 w-40" loading={loading} onClick={() => setLoading(true)}>
          Change Email
        </Button>
      )}
      {acceptNewEmail && (
        <p className="mt-4 bg-gray-100 flex p-3 pt-4 text-sm text-gray-500 rounded drop-shadow-md">
          <span className="mr-2">
            <Sparkles fill="#888" size={21} />
          </span>
          Email update initiated! Please check your new email address for a confirmation link.
        </p>
      )}
    </TabSection>
  </div>
)

const SecurityTab = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()
  const { profileData, loadingProfileData, profileFetchingError } = useProfileData()

  const { email, setEmail, error: emailError, setError: setEmailError } = useEmail(user.email)
  const [displayChangeEmailSection, setDisplayChangeEmailSection] = useState(false)
  const [loading, setLoading] = useState(false)
  const [acceptNewEmail, setAcceptNewEmail] = useState(false)

  useEffect(() => {
    if (profileFetchingError) {
      console.error(profileFetchingError)
      toast.error('Error fetching your profile: ' + profileFetchingError.message)
    }
  }, [loadingProfileData, profileData, profileFetchingError])

  if (profileFetchingError) {
    console.error(profileFetchingError)
    toast.error('Error fetching your profile: ' + profileFetchingError.message)
  }

  const validateEmailMutation = useMutation(
    (email) =>
      fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).then((res) => {
        if (!res.ok) {
          console.error('Invalid email')
          setEmailError('Invalid email provider or domain!')
        }
        return res.json()
      }),
    {
      onError: (error) => {
        console.error('Failed to validate email:', error)
      },
      onSuccess: (res) => {
        if (!res.isValid) {
          setEmailError('Invalid email provider or domain!')
        }
      }
    }
  )

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
  }

  const saveNewEmail = async (e) => {
    e.preventDefault()
    if (emailError) return
    if (email.length === 0) return

    if (email === user.email) return toast.error('You are already using this email!')

    setLoading(true)

    try {
      const { isValid } = await validateEmailMutation.mutateAsync(email)
      if (!isValid) return toast.error('Invalid email provider or domain!')

      // const { error } = await supabaseClient.from('profiles').update({ email }).eq('id', user.id)
      const { user, error } = await supabaseClient.auth.updateUser({
        email,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_SUPABASE_OTP_EMAIL_REDIRECT
        }
      })

      if (error) {
        console.error(error)
        toast.error('Error updating your email: ' + error.message)
      } else {
        toast.success('Email updated initiated!')
        setAcceptNewEmail(true)
        setDisplayChangeEmailSection(false)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setEmail(user.email)
    }
  }

  return loadingProfileData ? (
    <div className="border-l h-full">
      <TabTitle>Security</TabTitle>
      <div className="p-4">Loading...</div>
    </div>
  ) : displayChangeEmailSection ? (
    <ChangeEmailSection
      email={email}
      emailError={emailError}
      handleEmailChange={handleEmailChange}
      saveNewEmail={saveNewEmail}
      loading={validateEmailMutation.isLoading || loading}
      setLoading={setDisplayChangeEmailSection}
    />
  ) : (
    <SecuritySection
      email={email}
      profileData={profileData}
      loading={displayChangeEmailSection}
      setLoading={setDisplayChangeEmailSection}
      acceptNewEmail={acceptNewEmail}
    />
  )
}

export default SecurityTab
