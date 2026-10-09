import { getPublicUserProfile } from '@api'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { ModalHeading } from '@components/ui/Dialog'
import { useAsyncRequest } from '@hooks/useAsyncRequest'
import { useAuthStore, useStore } from '@stores'
import type { PostgrestError } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo } from 'react'

import { ProfileDialogShell } from './ProfileDialogShell'
import { ProfileLinkRow } from './ProfileLinkRow'
import { isNonEmptyString, sanitizeProfileLinks } from './profileLinks'
import {
  UserProfileDialogHeaderSkeleton,
  UserProfileDialogSkeleton
} from './UserProfileDialogSkeleton'

interface UserProfileDialogProps {
  userId: string
}

type UserProfileResponse = Awaited<ReturnType<typeof getPublicUserProfile>>
type UserProfileRecord = NonNullable<UserProfileResponse['data']>

export const UserProfileDialog = ({ userId }: UserProfileDialogProps) => {
  const closeDialog = useStore((state) => state.closeDialog)
  const viewerId = useAuthStore((state) => state.profile?.id)
  const {
    data: userData,
    loading,
    request,
    setData,
    error
  } = useAsyncRequest<UserProfileRecord | null, PostgrestError | null>(
    getPublicUserProfile,
    null,
    false
  )

  const loadProfile = useCallback(() => {
    request(userId).catch((requestError) => {
      console.error('Failed to load user profile', requestError)
    })
  }, [request, userId])

  useEffect(() => {
    setData(null)
    if (!userId) return

    loadProfile()

    return () => {
      setData(null)
    }
  }, [userId, loadProfile, setData])

  const links = useMemo(() => sanitizeProfileLinks(userData?.profile_data?.linkTree), [userData])

  if (!userId) {
    return (
      <ProfileDialogShell title="No user selected" message="Choose a user to see their profile." />
    )
  }

  if (loading) {
    return (
      <ProfileDialogShell title="Loading profile" busy header={<UserProfileDialogHeaderSkeleton />}>
        <UserProfileDialogSkeleton />
      </ProfileDialogShell>
    )
  }

  if (error) {
    return (
      <ProfileDialogShell
        title="Unable to load profile"
        message={error.message || 'Please try again later.'}>
        <Button variant="quiet" className="self-start" onClick={loadProfile}>
          Try again
        </Button>
      </ProfileDialogShell>
    )
  }

  if (!userData) {
    return (
      <ProfileDialogShell
        title="User not available"
        message="We couldn't load this profile right now."
      />
    )
  }

  const fullName = isNonEmptyString(userData.full_name) ? userData.full_name.trim() : 'Unknown user'
  const username = isNonEmptyString(userData.username) ? userData.username.trim() : undefined
  const rawBio = userData.profile_data?.bio
  const bio = isNonEmptyString(rawBio) ? rawBio.trim() : undefined
  const isOwnProfile = viewerId != null && viewerId === (userData.id || userId)

  const emptyProfile = isOwnProfile ? (
    <div className="flex items-center gap-3 p-6">
      <p className="text-base-content/60 min-w-0 flex-1 text-sm">No bio or links yet.</p>
      <Button
        variant="ghost"
        size="sm"
        className="text-primary hover:bg-primary/10 shrink-0"
        onClick={() => {
          closeDialog()
          window.location.hash = '#settings?tab=profile'
        }}>
        Add bio and links
      </Button>
    </div>
  ) : (
    <p className="text-base-content/60 p-6 text-sm">No bio or links yet.</p>
  )

  return (
    <ProfileDialogShell
      title={fullName}
      titleInHeader
      header={
        <>
          <Avatar
            face={{ ...userData, id: userData.id || userId }}
            alt={fullName}
            clickable={false}
            size="2xl"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 self-center">
            <ModalHeading className="truncate text-nowrap">{fullName}</ModalHeading>
            {username ? <p className="text-base-content/60 truncate text-sm">@{username}</p> : null}
          </div>
        </>
      }>
      {bio || links.length > 0 ? (
        <div className="space-y-4 p-6">
          {bio ? (
            <section>
              <h3 className="text-base-content mb-2 text-base font-semibold">About</h3>
              <p className="text-base-content text-sm whitespace-pre-line">{bio}</p>
            </section>
          ) : null}

          {links.length > 0 ? (
            <section>
              <h3 className="text-base-content mb-2 text-base font-semibold">Links</h3>
              <div className="flex flex-col gap-2">
                {links.map((link) => (
                  <ProfileLinkRow key={link.key} link={link} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        emptyProfile
      )}
    </ProfileDialogShell>
  )
}
