import { useState, useEffect, useCallback } from 'react'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useMutation } from '@tanstack/react-query'
import { Envelope, AngleSmallLeft } from '../../../icons/Icons'
import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'
import InputOverlapLabel from '../../../InputOverlapLabel'
import Button from '../../../Button'
import toast from 'react-hot-toast'
import useEmail from '../../../../hooks/useEmail'

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
        {emailError && <p className="text-red-500 text-xs mt-2 font-semibold">{emailError}</p>}
      </div>
      <Button className="mt-6 w-40" onClick={saveNewEmail} loading={loading}>
        Save changes
      </Button>
    </TabSection>
  </div>
)

const SecuritySection = ({ email, profileData, loading, setLoading }) => (
  <div className="border-l h-full">
    <TabTitle>Security</TabTitle>
    <TabSection name="Account email" description="The email address associated with your docs.plus account">
      <div className="flex flex-col">
        <InputOverlapLabel
          Icon={Envelope}
          size={18}
          label="Email"
          className="mt-4"
          value={email || profileData?.email}
          disabled={true}
        />
      </div>
      <Button className="mt-6 w-40" onClick={() => setLoading(true)}>
        Change Email
      </Button>
    </TabSection>
  </div>
)

const SecurityTab = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()

  const { email, setEmail, error: emailError } = useEmail(user.email)
  const [displayChangeEmailSection, setDisplayChangeEmailSection] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState(null)
  const [loadingProfileData, setLoadingProfileData] = useState(true)

  useEffect(() => {
    setLoadingProfileData(true)
    const fetchProfile = async () => {
      const { data, error } = await supabaseClient.from('profiles').select().eq('id', user.id).single()
      if (error) {
        console.error(error)
        toast.error('Error fetching your profile: ' + error.message)
      } else {
        setProfileData(data)
        setEmail(data.email || user.email)
        setLoadingProfileData(false)
      }
    }
    fetchProfile()
  }, [user.id, supabaseClient, setEmail])

  const validateEmailMutation = useMutation(
    (email) =>
      fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).then((res) => {
        if (!res.ok) {
          console.error('Invalid email')
          throw new Error('Invalid email')
        }
        return res.json()
      }),
    {
      onError: (error) => {
        console.error('Failed to validate email:', error)
      },
      onSuccess: (res) => {
        if (!res.isValid) {
          throw new Error('Invalid email')
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

    try {
      const { isValid } = await validateEmailMutation.mutateAsync(email)
      if (!isValid) return

      const { error } = await supabaseClient.from('profiles').update({ email }).eq('id', user.id)
      if (error) {
        console.error(error)
        toast.error('Error updating your email: ' + error.message)
      } else {
        toast.success('Email updated successfully')
        setDisplayChangeEmailSection(false)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
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
    />
  )
}

export default SecurityTab
