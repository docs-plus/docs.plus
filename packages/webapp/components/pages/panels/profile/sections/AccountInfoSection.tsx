import React, { useState, useCallback, useRef } from 'react'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import { At, CircleUser } from '@icons'
import { useAuthStore } from '@stores'
import { debounce } from 'lodash'
import { useUsernameValidation } from '../hooks/useUsernameValidation'
import * as toast from '@components/toast'

const USERNAME_DEBOUNCE_MS = 2000

const AccountInfoSection: React.FC = () => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const [errorBorderClass, setErrorBorderClass] = useState('')
  const [inputUsername, setInputUsername] = useState(user?.username || '')
  const validationPromiseRef = useRef<Promise<boolean>>(Promise.resolve(false))

  const { validateUsername } = useUsernameValidation()

  const debouncedValidate = useCallback(
    debounce((username: string, resolve: (value: boolean) => void) => {
      validateUsername(username).then(({ isValid, errorMessage }) => {
        setErrorBorderClass(isValid ? 'border-green-500' : 'border-red-500')
        if (errorMessage) {
          toast.Error(errorMessage)
        }
        resolve(isValid)
      })
    }, USERNAME_DEBOUNCE_MS),
    [validateUsername]
  )

  const handleUsernameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const newUsername = e.target.value.toLowerCase()
    setInputUsername(newUsername)

    if (newUsername === '') {
      setErrorBorderClass('')
      return
    }

    validationPromiseRef.current = new Promise((resolve) => {
      debouncedValidate(newUsername, resolve)
    })

    const isValid = await validationPromiseRef.current
    if (isValid) {
      setProfile({ ...user, username: newUsername })
    }
  }

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const newFullName = e.target.value
    if (newFullName !== user.full_name) {
      setProfile({ ...user, full_name: newFullName })
    }
  }

  return (
    <div className="flex flex-col">
      <InputOverlapLabel
        Icon={At}
        size={17}
        label="Full Name"
        className="mt-4"
        value={user?.full_name || ''}
        onChange={handleFullNameChange}
      />
      <InputOverlapLabel
        Icon={CircleUser}
        label="Username"
        className={`mt-4 ${errorBorderClass}`}
        value={inputUsername}
        onChange={handleUsernameChange}
      />
    </div>
  )
}

export default AccountInfoSection
