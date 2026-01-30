import { removeFileFromStorage,uploadFileToStorage } from '@api'
import * as toast from '@components/toast'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import Textarea from '@components/ui/Textarea'
import TextInput from '@components/ui/TextInput'
import Config from '@config'
import { useAuthStore } from '@stores'
import type { Profile } from '@types'
import { supabaseClient } from '@utils/supabase'
import { debounce } from 'lodash'
import { useCallback, useEffect,useRef, useState } from 'react'
import { CgSpinner } from 'react-icons/cg'
import { MdCameraAlt } from 'react-icons/md'

import { useProfileUpdate } from './hooks/useProfileUpdate'
import { useUsernameValidation } from './hooks/useUsernameValidation'
import SocialLinks from './SocialLinks'

interface ProfileContentProps {
  onBack?: () => void
}

const USERNAME_DEBOUNCE_MS = 1000

// Helper to update avatar in DB
const updateAvatarInDB = async (avatarUrl: string | null, userId: string) => {
  try {
    const avatar_updated_at = avatarUrl ? new Date().toISOString() : null

    const { error: dbError } = await supabaseClient
      .from('users')
      .update({ avatar_updated_at })
      .match({ id: userId })

    await new Promise((resolve) => setTimeout(resolve, 1000))

    const { error: authError } = await supabaseClient.auth.updateUser({
      data: { avatar_updated_at, c_avatar_url: avatarUrl }
    })

    if (dbError || authError) {
      throw dbError || authError
    }

    return true
  } catch (error) {
    console.error(error)
    throw error
  }
}

const ProfileContent = ({ onBack: _onBack }: ProfileContentProps) => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const { loading, handleSave } = useProfileUpdate()
  const { validateUsername } = useUsernameValidation()

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [hasCustomAvatar, setHasCustomAvatar] = useState(false)

  // Username state
  const [inputUsername, setInputUsername] = useState(user?.username || '')
  const [usernameError, setUsernameError] = useState<boolean | undefined>(undefined)
  const latestUsernameRef = useRef<string>('')

  useEffect(() => {
    setHasCustomAvatar(!!user?.avatar_url)
  }, [user])

  // Avatar handlers
  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAvatarChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file || !user) return

      if (file.size > 256000) {
        toast.Error('Avatar must be less than 256KB')
        return
      }

      if (!file.type.includes('image')) {
        toast.Error('Avatar must be an image')
        return
      }

      setUploading(true)

      try {
        const filePath = `public/${user.id}.png`
        const bucketAddress = Config.app.profile.getAvatarURL(user.id, Date.now().toString())

        const [uploadResult, dbResult] = await Promise.allSettled([
          uploadFileToStorage(Config.app.profile.avatarBucketName, filePath, file),
          updateAvatarInDB(bucketAddress, user.id)
        ])

        if (uploadResult.status === 'rejected' || dbResult.status === 'rejected') {
          toast.Error('Error uploading avatar, please try again.')
        } else {
          setHasCustomAvatar(true)
          toast.Success('Avatar uploaded successfully!')
        }
      } catch (error) {
        console.error(error)
        toast.Error('Error uploading avatar, please try again.')
      } finally {
        setUploading(false)
      }
    },
    [user]
  )

  const handleRemoveAvatar = useCallback(async () => {
    if (!user) return

    try {
      const [dbResult, storageResult] = await Promise.allSettled([
        updateAvatarInDB(null, user.id),
        removeFileFromStorage(Config.app.profile.avatarBucketName, `public/${user.id}.png`)
      ])

      if (dbResult.status === 'rejected' || storageResult.status === 'rejected') {
        toast.Error('Error removing avatar, please try again.')
      } else {
        setHasCustomAvatar(false)
        toast.Success('Avatar removed successfully!')
      }
    } catch (error) {
      console.error(error)
      toast.Error('Error removing avatar, please try again.')
    }
  }, [user])

  // Username validation with debounce
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
    const newProfileData = {
      ...((user?.profile_data as Profile) ?? {}),
      bio
    }
    setProfile({ ...user, profile_data: newProfileData })
  }

  const handleSubmit = () => {
    handleSave()
  }

  return (
    <div className="space-y-6">
      {/* Profile Picture */}
      <section className="bg-base-100 rounded-2xl p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Button
              onClick={handleAvatarClick}
              className="group border-base-300 hover:border-primary relative size-24 overflow-hidden rounded-2xl border-2 p-0 transition-all hover:shadow-md"
              disabled={uploading}>
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
                }`}>
                {uploading ? (
                  <CgSpinner size={22} className="animate-spin text-white" />
                ) : (
                  <MdCameraAlt size={22} className="text-white" />
                )}
              </div>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-base-content text-base font-semibold">Profile Picture</h3>
            <p className="text-base-content/60 text-sm">Upload a photo (max 256KB)</p>
            <div className="flex gap-2">
              <Button
                onClick={handleAvatarClick}
                variant="info"
                btnStyle="soft"
                size="sm"
                disabled={uploading}
                startIcon={MdCameraAlt}>
                Upload
              </Button>
              {hasCustomAvatar && (
                <Button
                  onClick={handleRemoveAvatar}
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
      <section className="bg-base-100 rounded-2xl p-4 shadow-sm sm:p-6">
        <h2 className="text-base-content mb-4 text-base font-semibold">Account Information</h2>
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
      <section className="bg-base-100 rounded-2xl p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base-content text-base font-semibold">Connect & Social Links</h2>
          <p className="text-base-content/60 mt-0.5 text-sm">
            Add your profiles so others can connect with you.
          </p>
        </div>
        <SocialLinks />
      </section>

      {/* Spacer to account for sticky footer */}
      <div className="h-16" />

      {/* Save Button - Sticky at bottom */}
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

export default ProfileContent
