import { useEffect, useMemo } from 'react'
import { MdMailOutline, MdPhone, MdLink } from 'react-icons/md'

import { getUserProfileForModal } from '@api'
import { Avatar } from '@components/ui/Avatar'
import Loading from '@components/ui/Loading'
import CloseButtonUI from '@components/ui/CloseButton'
import { SOCIAL_MEDIA_ICONS } from '@components/profile/constants'
import { ILinkItem } from '@components/profile/types'
import { useStore } from '@stores'
import { useSupabase } from '@hooks/useSupabase'
import type { PostgrestError } from '@supabase/supabase-js'

interface UserProfileDialogProps {
  userId: string
}

type RawLink = Partial<ILinkItem> & {
  metadata?: Partial<ILinkItem['metadata']>
}

type SanitizedLink = {
  key: string
  url: string
  type: ILinkItem['type'] | string
  title: string
  description?: string
  themeColor?: string
}

type UserProfileResponse = Awaited<ReturnType<typeof getUserProfileForModal>>
type UserProfileRecord = NonNullable<UserProfileResponse['data']>

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const sanitizeLinks = (rawLinks: unknown): SanitizedLink[] => {
  if (!Array.isArray(rawLinks)) return []

  return rawLinks.reduce<SanitizedLink[]>((acc, current, index) => {
    if (!current || typeof current !== 'object') return acc

    const link = current as RawLink
    const url = isNonEmptyString(link.url) ? link.url.trim() : ''
    if (!url) return acc

    const type = isNonEmptyString(link.type) ? link.type.trim() : 'simple'
    const metadata =
      link.metadata && typeof link.metadata === 'object'
        ? link.metadata
        : ({} as Partial<ILinkItem['metadata']>)

    const title = isNonEmptyString(metadata?.title) ? metadata.title.trim() : url
    const description = isNonEmptyString(metadata?.description)
      ? metadata.description.trim()
      : undefined
    const themeColor = isNonEmptyString(metadata?.themeColor)
      ? metadata.themeColor.trim()
      : undefined

    acc.push({
      key: `${url}-${index}`,
      url,
      type,
      title,
      description,
      themeColor
    })

    return acc
  }, [])
}

export const UserProfileDialog = ({ userId }: UserProfileDialogProps) => {
  const closeDialog = useStore((state) => state.closeDialog)
  const {
    data: userData,
    loading,
    request,
    setData,
    error
  } = useSupabase<UserProfileRecord | null, PostgrestError | null>(
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

  const links = useMemo(() => sanitizeLinks(userData?.profile_data?.linkTree), [userData])

  const getLinkIcon = (link: SanitizedLink) => {
    if (link.type === 'email') {
      return <MdMailOutline className="size-5 text-slate-600" aria-hidden="true" />
    }

    if (link.type === 'phone') {
      return <MdPhone className="size-5 text-slate-600" aria-hidden="true" />
    }

    if (link.type === 'social') {
      try {
        const domain = new URL(link.url).hostname.replace('www.', '')
        const SocialIcon = SOCIAL_MEDIA_ICONS[domain]?.icon
        if (SocialIcon) {
          return (
            <SocialIcon className="size-5" style={{ color: SOCIAL_MEDIA_ICONS[domain].color }} />
          )
        }
      } catch {
        // Ignore parsing failures and fall back to the default icon below.
      }
    }

    return <MdLink className="size-5 text-slate-600" aria-hidden="true" />
  }

  const renderLinkItem = (link: SanitizedLink) => {
    const href =
      link.type === 'email'
        ? `mailto:${link.url}`
        : link.type === 'phone'
          ? `tel:${link.url}`
          : link.url

    const openInNewTab = link.type === 'social' || link.type === 'simple'

    return (
      <a
        key={link.key}
        href={href}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition-colors hover:bg-slate-100">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
          {getLinkIcon(link)}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-700">{link.title}</span>
          {link.description && (
            <span className="block truncate text-xs text-slate-500">{link.description}</span>
          )}
        </div>
      </a>
    )
  }

  // Close button component for reuse
  const CloseButton = () => <CloseButtonUI onClick={closeDialog} />

  if (!userId) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">No user selected</h2>
            <p className="text-sm text-slate-500">Choose a user to see their profile.</p>
          </div>
          <CloseButton />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Unable to load profile</h2>
            <p className="text-sm text-slate-500">{error.message || 'Please try again later.'}</p>
          </div>
          <CloseButton />
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">User not available</h2>
            <p className="text-sm text-slate-500">We couldn&apos;t load this profile right now.</p>
          </div>
          <CloseButton />
        </div>
      </div>
    )
  }

  const fullName = isNonEmptyString(userData.full_name) ? userData.full_name.trim() : 'Unknown user'
  const username = isNonEmptyString(userData.username) ? userData.username.trim() : undefined
  const bio = isNonEmptyString(userData.profile_data?.bio)
    ? userData.profile_data.bio.trim()
    : undefined
  const hasContactInfo = links.length > 0

  return (
    <div className="flex max-h-[80vh] flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar
            id={userData.id || userId}
            src={isNonEmptyString(userData.avatar_url) ? userData.avatar_url : undefined}
            avatarUpdatedAt={userData.avatar_updated_at}
            alt={fullName}
            clickable={false}
            className="size-14 shrink-0 rounded-full border-2 border-white object-cover shadow-md sm:size-16"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-slate-800 sm:text-xl">{fullName}</h2>
            {username && <p className="truncate text-sm text-slate-500">@{username}</p>}
          </div>
          <CloseButton />
        </div>
      </div>

      {/* Divider */}
      {(bio || hasContactInfo) && <div className="h-px bg-slate-200" />}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {bio && (
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">
              About
            </h3>
            <p className="text-sm whitespace-pre-line text-slate-600 sm:text-base">{bio}</p>
          </div>
        )}

        {hasContactInfo && (
          <div>
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">
              Links
            </h3>
            <div className="flex flex-col gap-2">{links.map(renderLinkItem)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
