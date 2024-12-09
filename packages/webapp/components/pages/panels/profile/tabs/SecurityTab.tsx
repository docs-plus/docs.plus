import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Envelope, AngleSmallLeft, Sparkles } from '@icons'
import TabTitle from '../components/TabTitle'
import TabSection from '../components/TabSection'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import Button from '@components/ui/Button'
import toast from 'react-hot-toast'
import useEmailValidation from '@hooks/useEmailValidation'
import { supabaseClient } from '@utils/supabase'
import { useAuthStore } from '@stores'
import { RiArrowRightSLine } from 'react-icons/ri'

const ChangeEmailSection = ({
  email,
  emailError,
  handleEmailChange,
  saveNewEmail,
  loading,
  setLoading,
  goBack
}: any) => (
  <div className="relative h-full w-full md:border-l">
    <TabTitle className="flex" title="Change email" goBack={() => setLoading(false)}></TabTitle>
    <TabSection>
      <div className="flex flex-col">
        <InputOverlapLabel
          Icon={Envelope}
          size={18}
          label="Email"
          className={`mt-4 ${emailError ? 'border-red-500' : ''}`}
          value={email}
          onChange={handleEmailChange}
        />
        {emailError}
        {emailError && <p className="mt-2 text-xs font-semibold text-red-500">{emailError}</p>}
      </div>
      <Button className="mt-6 w-40" onClick={saveNewEmail} loading={loading}>
        Save changes
      </Button>
    </TabSection>
  </div>
)

const SecuritySection = ({ email, loading, acceptNewEmail, setLoading, goBack }: any) => (
  <div className="relative h-full w-full md:border-l">
    <TabTitle className="flex" goBack={goBack} title="Security"></TabTitle>
    <TabSection
      name="Account email"
      description="The email address associated with your docs.plus account">
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
        <p className="mt-4 flex rounded bg-gray-100 p-3 pt-4 text-sm text-gray-500 drop-shadow-md">
          <span className="mr-2">
            <Sparkles fill="#888" size={21} />
          </span>
          Email update initiated! Please check your new email address for a confirmation link.
        </p>
      )}
    </TabSection>
  </div>
)

const SecurityTab = ({ goBack }: any) => {
  const user = useAuthStore((state) => state.profile)

  const {
    email,
    setEmail,
    error: emailError,
    setError: setEmailError
  } = useEmailValidation(user.email)

  const [displayChangeEmailSection, setDisplayChangeEmailSection] = useState(false)
  const [loading, setLoading] = useState(false)
  const [acceptNewEmail, setAcceptNewEmail] = useState(false)

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
    toast.error('This feature is temporarily unavailable.')
    return
    e.preventDefault()
    if (emailError) return
    if (email.length === 0) return

    if (email === user.email) return toast.error('You are already using this email!')

    setLoading(true)

    try {
      const { isValid } = await validateEmailMutation.mutateAsync(email)
      if (!isValid) return toast.error('Invalid email provider or domain!')

      const pathname = window.location.pathname.split('/')
      pathname.shift()
      const redirectPathname = pathname.join('/')

      // const { error } = await supabaseClient.from('profiles').update({ email }).eq('id', user.id)
      const { error } = await supabaseClient.auth.updateUser({
        email,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_SUPABASE_OTP_EMAIL_REDIRECT + redirectPathname
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

  return displayChangeEmailSection ? (
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
      goBack={goBack}
      email={email}
      profileData={user}
      loading={displayChangeEmailSection}
      setLoading={setDisplayChangeEmailSection}
      acceptNewEmail={acceptNewEmail}
    />
  )
}

export default SecurityTab
