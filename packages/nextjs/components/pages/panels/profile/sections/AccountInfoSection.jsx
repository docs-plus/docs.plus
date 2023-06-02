import InputOverlapLabel from '../../../../InputOverlapLabel'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import React, { useState, useCallback } from 'react'
import { debounce } from 'lodash'
import toast from 'react-hot-toast'
import { At, CircleUser } from '../../../../icons/Icons'

// Defined constants
const PROFILES = 'profiles'

const AccountInfoSection = ({ fullName, setFullName, userName, setUserName, profileData }) => {
  const supabaseClient = useSupabaseClient()
  const [errorBorderClass, setErrorBorderClass] = useState('')

  const checkUserName = useCallback(
    debounce(
      async userName => {
        if (userName === profileData?.username) {
          setErrorBorderClass('border-green-500')
          return true
        }

        if (userName.length < 4) {
          toast.error('Username must be at least 3 characters long.')
          setErrorBorderClass('border-red-500')

          return
        }

        // check usename must not contain spaces
        if (userName.indexOf(' ') >= 0) {
          toast.error('Username must not contain spaces.')
          setErrorBorderClass('border-red-500')

          return
        }

        const { data, error } = await supabaseClient
          .from(PROFILES)
          .select('username')
          .eq('username', userName)

        if (error) {
          console.error(error)
          toast.error('Error fetching user profile')
          setErrorBorderClass('border-red-500')
          return
        }

        if (data.length > 0) {
          toast.error('Username already taken')
          setErrorBorderClass('border-red-500')
          return
        }
        setErrorBorderClass('border-green-500')
        return true
      },
      650,
      { leading: false, trailing: true }
    ),
    [supabaseClient, profileData]
  )

  const handleUserNameChange = e => {
    const userName = e.target.value
    setUserName(userName)
    checkUserName(userName)
  }

  return (
    <div className="flex flex-col">
      <InputOverlapLabel
        Icon={At}
        size={17}
        label="Full Name"
        className={`mt-4`}
        value={fullName}
        onChange={e => setFullName(e.target.value)}
      />
      <InputOverlapLabel
        Icon={CircleUser}
        label="Username"
        className={`mt-4 ${errorBorderClass}`}
        value={userName}
        onChange={handleUserNameChange}
      />
    </div>
  )
}

export default AccountInfoSection
