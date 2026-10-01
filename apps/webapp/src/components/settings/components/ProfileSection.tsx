import type { ProfileChange } from '@api'
import { Avatar } from '@components/ui/Avatar'
import Button, { dangerGhostClassName } from '@components/ui/Button'
import Textarea from '@components/ui/Textarea'
import TextInput from '@components/ui/TextInput'
import { useAuthStore } from '@stores'
import { sheetSafeAreaPadMobileClassName } from '@utils/sheetBodyPadding'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuCamera, LuLink, LuUser } from 'react-icons/lu'

import { useAvatarUpload } from '../hooks/useAvatarUpload'
import { useProfileUpdate } from '../hooks/useProfileUpdate'
import { useUsernameValidation } from '../hooks/useUsernameValidation'
import SettingsCard, { SettingsCardHeader } from './SettingsCard'
import SocialLinks from './SocialLinks'

const USERNAME_DEBOUNCE_MS = 1000

const ProfileSection = () => {
  const user = useAuthStore((state) => state.profile)
  const { loading, handleSave } = useProfileUpdate()
  const { validateUsername } = useUsernameValidation()
  const { uploading, handleUpload, handleRemove } = useAvatarUpload()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasCustomAvatar = !!user?.avatar_updated_at

  // Locally controlled inputs — committed to the store only on Save so
  // keystrokes don't fan out re-renders to every `profile` subscriber.
  const [inputUsername, setInputUsername] = useState(user?.username || '')
  const [inputFullName, setInputFullName] = useState(user?.full_name || '')
  const [inputBio, setInputBio] = useState(user?.profile_data?.bio || '')
  const [usernameError, setUsernameError] = useState<boolean | undefined>(undefined)
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null)
  const latestUsernameRef = useRef<string>('')

  const storedUsername = user?.username || ''
  const storedFullName = user?.full_name || ''
  const storedBio = user?.profile_data?.bio || ''
  const seededRef = useRef({ username: storedUsername, fullName: storedFullName, bio: storedBio })

  // A save from another tab or device reaches only the fields not being edited here.
  useEffect(() => {
    const seeded = seededRef.current
    setInputUsername((value) => (value === seeded.username ? storedUsername : value))
    setInputFullName((value) => (value === seeded.fullName ? storedFullName : value))
    setInputBio((value) => (value === seeded.bio ? storedBio : value))
    seededRef.current = { username: storedUsername, fullName: storedFullName, bio: storedBio }
  }, [storedUsername, storedFullName, storedBio])

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

  const debouncedValidate = useMemo(
    () =>
      debounce((username: string) => {
        validateUsername(username).then(({ isValid, errorMessage }) => {
          if (username !== latestUsernameRef.current) return
          setUsernameError(!isValid)
          setUsernameMessage(errorMessage)
        })
      }, USERNAME_DEBOUNCE_MS),
    [validateUsername]
  )

  useEffect(() => () => debouncedValidate.cancel(), [debouncedValidate])

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value.toLowerCase()
    setInputUsername(newUsername)
    latestUsernameRef.current = newUsername
    setUsernameMessage(null)

    if (newUsername === '') {
      setUsernameError(undefined)
      return
    }

    debouncedValidate(newUsername)
  }

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputFullName(e.target.value)
  }

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputBio(e.target.value)
  }

  const handleSubmit = () => {
    if (!user) return
    debouncedValidate.cancel()
    // The reason shows under the field; `handleSave` re-checks on the server path.
    if (inputUsername.trim() === '') {
      setUsernameError(true)
      setUsernameMessage('Username cannot be empty.')
      return
    }
    if (usernameError === true) return
    // Only what differs: an unchanged field must not overwrite a newer value from elsewhere.
    const change: ProfileChange = {}
    if (inputUsername !== storedUsername) change.username = inputUsername
    if (inputFullName !== storedFullName) change.full_name = inputFullName
    if (inputBio !== storedBio) change.profile_data = { bio: inputBio }
    if (Object.keys(change).length === 0) return
    void handleSave(change, 'Profile saved.')
  }

  return (
    <div className="space-y-4 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
      <SettingsCard>
        <div className="flex items-center gap-5">
          <div className="relative">
            <Button
              onClick={handleAvatarClick}
              className="group relative size-24 rounded-full border-0 bg-transparent p-0 transition-[box-shadow] hover:shadow-md"
              disabled={uploading}
              aria-label="Upload profile picture">
              <Avatar face={user} clickable={false} className="size-full" />
              <div
                className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/40 transition-opacity ${
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-base-content text-base font-semibold">Profile picture</h3>
              <p className="text-meta text-base-content/60">
                Upload a photo (JPEG, PNG, WebP, or AVIF — max 256KB)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleAvatarClick}
                variant="quiet"
                disabled={uploading}
                startIcon={LuCamera}>
                Upload
              </Button>
              {hasCustomAvatar && (
                <Button
                  onClick={handleRemove}
                  disabled={uploading}
                  variant="ghost"
                  size="sm"
                  className={dangerGhostClassName}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsCardHeader icon={LuUser} title="Account information" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Full name"
            labelPosition="above"
            value={inputFullName}
            onChange={handleFullNameChange}
          />

          <TextInput
            label="Username"
            labelPosition="above"
            value={inputUsername}
            onChange={handleUsernameChange}
            error={usernameError === true}
            helperText={usernameMessage ?? undefined}
            success={usernameError === false}
          />
        </div>

        <div className="mt-4">
          <Textarea
            label="About"
            labelPosition="above"
            value={inputBio}
            onChange={handleBioChange}
            rows={4}
          />
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsCardHeader
          icon={LuLink}
          title="Connect & social links"
          description="Add your profiles so others can connect with you."
        />
        <SocialLinks onSave={handleSave} saveLoading={loading} />
      </SettingsCard>

      {/* Spacer to account for sticky footer */}
      <div className="h-16" />

      {/* Save Button — sticky footer; bg must match ScrollArea bg in SettingsPanel (base-200) */}
      <div
        className={`bg-base-200 border-base-300 sticky bottom-0 -mx-4 border-t px-4 py-4 ${sheetSafeAreaPadMobileClassName} sm:-mx-6 sm:px-6`}>
        <Button
          onClick={handleSubmit}
          loading={loading}
          variant="primary"
          shape="block"
          className="font-semibold">
          Save changes
        </Button>
      </div>
    </div>
  )
}

export default ProfileSection
