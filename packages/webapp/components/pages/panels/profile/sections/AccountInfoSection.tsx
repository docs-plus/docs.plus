import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import React, { useState, useCallback } from 'react'
import { debounce } from 'lodash'
import toast from 'react-hot-toast'
import { At, CircleUser } from '@icons'
import { useAuthStore } from '@stores'
import { getSimilarUsername } from '@api'

// Defined constants

const AccountInfoSection = () => {
  const [errorBorderClass, setErrorBorderClass] = useState('')
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)

  const checkUsername = useCallback(
    debounce(
      async (username: string) => {
        if (!username) return
        if (username === user?.username) {
          setErrorBorderClass('border-green-500')
          return true
        }

        if (username.length < 4) {
          toast.error('Username must be at least 3 characters long.')
          setErrorBorderClass('border-red-500')
          return
        }

        // check usename must not contain spaces
        if (username.indexOf(' ') >= 0) {
          toast.error('Username must not contain spaces.')
          setErrorBorderClass('border-red-500')
          return
        }

        const { data, error } = await getSimilarUsername(username)

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
    [user]
  )

  const handleUsernameChange = (event: any) => {
    const username = event.target.value
    if (!username || !user) return

    setProfile({ ...user, username })

    if (username === '') {
      setErrorBorderClass('')
      return
    }
    checkUsername(username)
  }

  const handelrFullName = (event: any) => {
    if (!user) return
    setProfile({ ...user, full_name: event.target.value })
  }

  return (
    <div className="flex flex-col">
      <InputOverlapLabel
        Icon={At}
        size={17}
        label="Full Name"
        className={`mt-4`}
        value={user?.full_name}
        onChange={handelrFullName}
      />
      <InputOverlapLabel
        Icon={CircleUser}
        label="Username"
        className={`mt-4 ${errorBorderClass}`}
        value={user?.username}
        onChange={handleUsernameChange}
      />
    </div>
  )
}

export default AccountInfoSection
