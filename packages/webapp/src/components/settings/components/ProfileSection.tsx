import * as toast from '@components/toast'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import Textarea from '@components/ui/Textarea'
import TextInput from '@components/ui/TextInput'
import { useAuthStore } from '@stores'
import type { ProfileData } from '@types'
import { debounce } from 'lodash'
import { useCallback, useRef, useState } from 'react'
import { LuCamera, LuLink, LuUser } from 'react-icons/lu'

import { useAvatarUpload } from '../hooks/useAvatarUpload'
import { useProfileUpdate } from '../hooks/useProfileUpdate'
import { useUsernameValidation } from '../hooks/useUsernameValidation'
import SocialLinks from './SocialLinks'

const USERNAME_DEBOUNCE_MS = 1000

const ProfileSection = () => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const { loading, handleSave } = useProfileUpdate()
  const { validateUsername } = useUsernameValidation()
  const { uploading, handleUpload, handleRemove } = useAvatarUpload()

  // Avatar — derived from store, file input ref for hidden <input>
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasCustomAvatar = !!user?.avatar_url

  // Username state
  const [inputUsername, setInputUsername] = useState(user?.username || '')
  const [usernameError, setUsernameError] = useState<boolean | undefined>(undefined)
  const latestUsernameRef = useRef<string>('')

  // --- Avatar handlers ---

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAvatarChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) handleUpload(file)
      // Reset input so re-selecting the same file triggers onChange
      if (event.target) event.target.value = ''
    },
    [handleUpload]
  )

  // --- Username validation with debounce ---

  const debouncedValidate = useCallback(
    debounce((username: string, resolve: (value: boolean) => void) => {
      validateUsername(username).then(({ isValid, errorMessage }) => {
        setUsernameError(!isValid)
        if (errorMessage && username === latestUsernameRef.current) {
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
    latestUsernameRef.current = newUsername

    if (newUsername === '') {
      setUsernameError(undefined)
      return
    }

    const isValid = await new Promise<boolean>((resolve) => {
      debouncedValidate(newUsername, resolve)
    })

    if (isValid) {
      setProfile({ ...user, username: newUsername })
    }
  }

  // --- Field handlers ---

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const newFullName = e.target.value
    if (newFullName !== user.full_name) {
      setProfile({ ...user, full_name: newFullName })
    }
  }

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!user) return
    const bio = e.target.value
    const newProfileData: ProfileData = {
      ...((user?.profile_data as ProfileData) ?? {}),
      bio
    }
    setProfile({ ...user, profile_data: newProfileData })
  }

  const handleSubmit = () => {
    handleSave()
  }

  // --- Render ---

  return (
    <div className="space-y-4">
      {/* Profile Picture */}
      <section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Button
              onClick={handleAvatarClick}
              className="group border-base-300 hover:border-primary rounded-box relative size-24 overflow-hidden border-2 p-0 transition-all hover:shadow-md"
              disabled={uploading}
              aria-label="Upload profile picture">
              <Avatar
                id={user?.id}
                src={user?.avatar_url}
                avatarUpdatedAt={user?.avatar_updated_at}
                alt={user?.display_name || user?.full_name}
                justImage={true}
                className="size-full object-cover"
              />
              <div
                className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
                  uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                aria-hidden="true">
                {uploading ? (
                  <span className="loading loading-spinner loading-md text-white" />
                ) : (
                  <LuCamera size={22} className="text-white" />
                )}
              </div>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              aria-label="Choose profile picture file"
            />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-base-content text-base font-semibold">Profile Picture</h2>
            <p className="text-base-content/60 text-sm">Upload a photo (max 256KB)</p>
            <div className="flex gap-2">
              <Button
                onClick={handleAvatarClick}
                variant="info"
                btnStyle="soft"
                size="sm"
                disabled={uploading}
                startIcon={LuCamera}>
                Upload
              </Button>
              {hasCustomAvatar && (
                <Button
                  onClick={handleRemove}
                  variant="ghost"
                  size="sm"
                  className="text-base-content/60 hover:text-error">
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Account Info + Bio Combined */}
      <section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <LuUser size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Account Information</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Full Name */}
          <TextInput
            label="Full Name"
            labelPosition="floating"
            placeholder="Full Name"
            value={user?.full_name || ''}
            onChange={handleFullNameChange}
          />

          {/* Username */}
          <TextInput
            label="Username"
            labelPosition="floating"
            placeholder="Username"
            value={inputUsername}
            onChange={handleUsernameChange}
            error={usernameError === true}
            success={usernameError === false}
          />
        </div>

        {/* Bio - Full width */}
        <div className="mt-4">
          <Textarea
            label="About"
            labelPosition="floating"
            placeholder="About"
            value={user?.profile_data?.bio || ''}
            onChange={handleBioChange}
            rows={4}
          />
        </div>
      </section>

      {/* Social Links */}
      <section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <LuLink size={20} className="text-primary" />
            <h2 className="text-base-content text-base font-semibold">Connect & Social Links</h2>
          </div>
          <p className="text-base-content/60 mt-0.5 pl-7 text-sm">
            Add your profiles so others can connect with you.
          </p>
        </div>
        <SocialLinks onSave={handleSave} saveLoading={loading} />
      </section>

      {/* Spacer to account for sticky footer */}
      <div className="h-16" />

      {/* Save Button — Sticky at bottom
          Gradient must match ScrollArea bg in SettingsPanel (bg-base-200) */}
      <div className="from-base-200 via-base-200 sticky bottom-0 -mx-4 bg-gradient-to-t to-transparent px-4 pt-6 pb-4 sm:-mx-6 sm:px-6">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          loading={loading}
          variant="primary"
          shape="block"
          className="font-semibold shadow-lg">
          Save Changes
        </Button>
      </div>
    </div>
  )
}

export default ProfileSection
