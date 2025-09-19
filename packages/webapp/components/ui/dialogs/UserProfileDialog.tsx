import { useEffect, useMemo } from 'react'
import { IoCloseSharp } from 'react-icons/io5'
import { MdMailOutline, MdPhone, MdLink } from 'react-icons/md'

import { getUserProfileForModal } from '@api'
import { Avatar } from '@components/ui/Avatar'
import Loading from '@components/ui/Loading'
import { SOCIAL_MEDIA_ICONS } from '@components/pages/panels/profile/constants'
import { ILinkItem } from '@components/pages/panels/profile/types'
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

const DEFAULT_LINK_BACKGROUND = 'rgba(15, 23, 42, 0.05)'

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

const computeLinkBackgroundColor = (color?: string) => {
  if (!color) return DEFAULT_LINK_BACKGROUND
  const trimmed = color.trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return `${trimmed}20`
  }
  return trimmed
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
      return <MdMailOutline className="h-5 w-5" aria-hidden="true" />
    }

    if (link.type === 'phone') {
      return <MdPhone className="h-5 w-5" aria-hidden="true" />
    }

    if (link.type === 'social') {
      try {
        const domain = new URL(link.url).hostname.replace('www.', '')
        const SocialIcon = SOCIAL_MEDIA_ICONS[domain]?.icon
        if (SocialIcon) {
          return (
            <SocialIcon className="h-5 w-5" style={{ color: SOCIAL_MEDIA_ICONS[domain].color }} />
          )
        }
      } catch {
        // Ignore parsing failures and fall back to the default icon below.
      }
    }

    return <MdLink className="h-5 w-5" aria-hidden="true" />
  }

  const renderLinkItem = (link: SanitizedLink) => {
    const href =
      link.type === 'email'
        ? `mailto:${link.url}`
        : link.type === 'phone'
          ? `tel:${link.url}`
          : link.url

    const openInNewTab = link.type === 'social' || link.type === 'simple'
    const backgroundColor = computeLinkBackgroundColor(link.themeColor)

    return (
      <div
        key={link.key}
        className="group hover:bg-opacity-30 mb-3 w-full rounded-lg p-3 transition-all"
        style={{ backgroundColor }}>
        <a
          href={href}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          className="flex items-center space-x-3 text-gray-700 hover:text-gray-900">
          <span className="flex-shrink-0">{getLinkIcon(link)}</span>
          <div className="flex-1 overflow-hidden">
            <span className="block truncate">{link.title}</span>
            {link.description && (
              <span className="mt-1 block truncate text-sm text-gray-500">{link.description}</span>
            )}
          </div>
        </a>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">No user selected</h2>
            <p className="text-sm text-gray-500">Choose a user to see their profile.</p>
          </div>
          <button className="btn btn-square btn-xs" onClick={closeDialog}>
            <IoCloseSharp size={20} />
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Unable to load profile</h2>
            <p className="text-sm text-gray-500">{error.message || 'Please try again later.'}</p>
          </div>
          <button className="btn btn-square btn-xs" onClick={closeDialog}>
            <IoCloseSharp size={20} />
          </button>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">User not available</h2>
            <p className="text-sm text-gray-500">We couldn&apos;t load this profile right now.</p>
          </div>
          <button className="btn btn-square btn-xs" onClick={closeDialog}>
            <IoCloseSharp size={20} />
          </button>
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
      <div className="sticky top-0 bg-white p-6 pb-0">
        <div className="flex items-center">
          <div className="flex flex-1 items-center space-x-4">
            <Avatar
              id={userData.id || userId}
              src={isNonEmptyString(userData.avatar_url) ? userData.avatar_url : undefined}
              avatarUpdatedAt={userData.avatar_updated_at}
              alt={fullName}
              clickable={false}
              className="size-[64px] rounded-full object-cover"
            />
            <div>
              <h2 className="text-xl font-bold">{fullName}</h2>
              {username && <p className="text-gray-600">@{username}</p>}
            </div>
          </div>
          <button className="btn btn-square btn-xs" onClick={closeDialog}>
            <IoCloseSharp size={20} />
          </button>
        </div>
      </div>

      {(bio || hasContactInfo) && <div className="divider h-0"></div>}

      <div className="flex-1 overflow-y-auto p-6 pt-0">
        {bio && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">About</h3>
            <p className="whitespace-pre-line text-gray-700">{bio}</p>
          </div>
        )}

        {hasContactInfo && (
          <div className="mt-5 space-y-3">
            <h3 className="text-lg font-semibold">Contact Information</h3>
            <div className="space-y-2">{links.map(renderLinkItem)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
