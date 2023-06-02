import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'
import InputOverlapLabel from '../../../InputOverlapLabel'
import { useUser } from '@supabase/auth-helpers-react'
import { useState } from 'react'
import { Envelope } from '../../../icons/Icons'
import Button from '../../../Button'

const SecurityTab = ({ profileData }) => {
  const user = useUser()

  const [email, setEmail] = useState(profileData?.email || user.email)
  const [emailError, setEmailError] = useState('')
  const [isEmailChanged, setIsEmailChanged] = useState(false)

  // const handleEmailChange = e => {
  //   const email = e.target.value
  //   setEmail(email)
  //   validateEmail(email)
  //   if (isEmailChanged) {
  //     setIsEmailChanged(false)
  //   }
  // }

  // const validateEmail = email => {
  //   if (!email) {
  //     setEmailError('Email is required')
  //   } else if (!isEmail(email)) {
  //     setEmailError('Email is invalid')
  //   } else {
  //     setEmailError('')
  //   }
  // }

  return (
    <div className="border-l h-full">
      <TabTitle>Security</TabTitle>
      <TabSection
        name="Account email"
        description="The email address associated with your docs.plus account">
        <div className="flex flex-col">
          <InputOverlapLabel
            Icon={Envelope}
            size={18}
            label="Email"
            className={`mt-4 ${emailError ? ' border-red-500' : ''}`}
            value={email}
            // onChange={handleEmailChange}
            readonly={true}
            disabled={true}
          />
          {emailError && <p className="text-red-500 text-xs mt-2 font-semibold">{emailError}</p>}
        </div>
        <Button className="mt-6 w-52">Change Email</Button>
      </TabSection>
    </div>
  )
}

export default SecurityTab
