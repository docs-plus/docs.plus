import { getUserProfileForModal } from '@api'
import { Avatar } from '@components/ui/Avatar'
import { useAsyncRequest } from '@hooks/useAsyncRequest'
import { useStore } from '@stores'
import type { PostgrestError } from '@supabase/supabase-js'
import { useEffect, useMemo } from 'react'

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

type UserProfileResponse = Awaited<ReturnType<typeof getUserProfileForModal>>
type UserProfileRecord = NonNullable<UserProfileResponse['data']>

const sectionLabelClass =
  'text-base-content/50 mb-2 text-xs font-semibold tracking-wide uppercase sm:text-sm'

export const UserProfileDialog = ({ userId }: UserProfileDialogProps) => {
  const closeDialog = useStore((state) => state.closeDialog)
  const {
    data: userData,
    loading,
    request,
    setData,
    error
  } = useAsyncRequest<UserProfileRecord | null, PostgrestError | null>(
    getUserProfileForModal,
    null,
    false
  )

  useEffect(() => {
    if (!userId) {
      setData(null)
      return
    }

    setData(null)

    request(userId).catch((requestError) => {
      console.error('Failed to load user profile', requestError)
    })

    return () => {
      setData(null)
    }
  }, [userId, request, setData])

  const links = useMemo(() => sanitizeProfileLinks(userData?.profile_data?.linkTree), [userData])

  if (!userId) {
    return (
      <ProfileDialogShell
        title="No user selected"
        message="Choose a user to see their profile."
        onClose={closeDialog}
      />
    )
  }

  if (loading) {
    return (
      <ProfileDialogShell
        title="Loading profile"
        onClose={closeDialog}
        busy
        header={<UserProfileDialogHeaderSkeleton />}>
        <UserProfileDialogSkeleton />
      </ProfileDialogShell>
    )
  }

  if (error) {
    return (
      <ProfileDialogShell
        title="Unable to load profile"
        message={error.message || 'Please try again later.'}
        onClose={closeDialog}
      />
    )
  }

  if (!userData) {
    return (
      <ProfileDialogShell
        title="User not available"
        message="We couldn't load this profile right now."
        onClose={closeDialog}
      />
    )
  }

  const fullName = isNonEmptyString(userData.full_name) ? userData.full_name.trim() : 'Unknown user'
  const username = isNonEmptyString(userData.username) ? userData.username.trim() : undefined
  const bio = isNonEmptyString(userData.profile_data?.bio)
    ? userData.profile_data.bio.trim()
    : undefined

  return (
    <ProfileDialogShell
      title={fullName}
      onClose={closeDialog}
      header={
        <>
          <Avatar
            id={userData.id || userId}
            src={isNonEmptyString(userData.avatar_url) ? userData.avatar_url : undefined}
            avatarUpdatedAt={userData.avatar_updated_at}
            alt={fullName}
            clickable={false}
            size="2xl"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 self-center">
            <p className="text-base-content truncate text-lg font-bold sm:text-xl">{fullName}</p>
            {username ? <p className="text-base-content/60 truncate text-sm">@{username}</p> : null}
          </div>
        </>
      }>
      {bio || links.length > 0 ? (
        <div className="space-y-6 p-4 sm:p-6">
          {bio ? (
            <section>
              <h3 className={sectionLabelClass}>About</h3>
              <p className="text-base-content/80 text-sm whitespace-pre-line sm:text-base">{bio}</p>
            </section>
          ) : null}

          {links.length > 0 ? (
            <section>
              <h3 className={sectionLabelClass}>Links</h3>
              <div className="flex flex-col gap-2">
                {links.map((link) => (
                  <ProfileLinkRow key={link.key} link={link} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <p className="text-base-content/50 p-4 text-sm sm:p-6">No bio or links yet.</p>
      )}
    </ProfileDialogShell>
  )
}
