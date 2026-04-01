import { getUserProfileForModal } from '@api'
import { getSocialColor, getSocialIcon } from '@components/settings/constants'
import { Avatar } from '@components/ui/Avatar'
import CloseButtonUI from '@components/ui/CloseButton'
import Loading from '@components/ui/Loading'
import { useAsyncRequest } from '@hooks/useAsyncRequest'
import { useStore } from '@stores'
import type { PostgrestError } from '@supabase/supabase-js'
import type { LinkItem } from '@types'
import { getGoogleFaviconUrl } from '@utils/link-helpers'
import { useEffect, useMemo } from 'react'
import { LuLink, LuMail, LuPhone } from 'react-icons/lu'

// --- Types ---

interface UserProfileDialogProps {
  userId: string
}

type RawLink = Partial<LinkItem> & {
  metadata?: Partial<LinkItem['metadata']>
}

type SanitizedLink = {
  key: string
  url: string
  type: LinkItem['type'] | string
  title: string
  description?: string
  themeColor?: string
}

type UserProfileResponse = Awaited<ReturnType<typeof getUserProfileForModal>>
type UserProfileRecord = NonNullable<UserProfileResponse['data']>

// --- Helpers ---

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
        : ({} as Partial<LinkItem['metadata']>)

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

// --- Link icon renderer (uses constants lookup — DRY) ---

const getLinkIcon = (link: SanitizedLink) => {
  if (link.type === 'email') {
    return <LuMail className="text-base-content/60 size-5" aria-hidden="true" />
  }

  if (link.type === 'phone') {
    return <LuPhone className="text-base-content/60 size-5" aria-hidden="true" />
  }

  // Brand icon for known social domains
  if (link.type === 'social') {
    try {
      const domain = new URL(link.url).hostname.replace('www.', '')
      const SocialIcon = getSocialIcon(domain)
      const color = getSocialColor(domain)
      if (SocialIcon) {
        return <SocialIcon className="size-5" style={color ? { color } : undefined} />
      }
    } catch {
      // fall through to favicon
    }
  }

  // Google Favicon for any URL-based link without a brand icon
  const faviconUrl = getGoogleFaviconUrl(link.url)
  if (faviconUrl) {
    return (
      <>
        <img
          src={faviconUrl}
          alt=""
          className="size-5 rounded-sm object-contain"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        <span className="hidden items-center justify-center">
          <LuLink className="text-base-content/60 size-5" aria-hidden="true" />
        </span>
      </>
    )
  }

  return <LuLink className="text-base-content/60 size-5" aria-hidden="true" />
}

// --- Component ---

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

  const links = useMemo(() => sanitizeLinks(userData?.profile_data?.linkTree), [userData])

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
        className="bg-base-200 hover:bg-base-300 flex items-center gap-3 rounded-xl p-3 transition-colors">
        <span className="bg-base-100 flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm">
          {getLinkIcon(link)}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-base-content block truncate text-sm font-medium">{link.title}</span>
          {link.description && (
            <span className="text-base-content/60 block truncate text-xs">{link.description}</span>
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
            <h2 className="text-base-content text-lg font-semibold">No user selected</h2>
            <p className="text-base-content/60 text-sm">Choose a user to see their profile.</p>
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
            <h2 className="text-base-content text-lg font-semibold">Unable to load profile</h2>
            <p className="text-base-content/60 text-sm">
              {error.message || 'Please try again later.'}
            </p>
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
            <h2 className="text-base-content text-lg font-semibold">User not available</h2>
            <p className="text-base-content/60 text-sm">
              We couldn&apos;t load this profile right now.
            </p>
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
      <div className="bg-base-100 sticky top-0 z-10 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar
            id={userData.id || userId}
            src={isNonEmptyString(userData.avatar_url) ? userData.avatar_url : undefined}
            avatarUpdatedAt={userData.avatar_updated_at}
            alt={fullName}
            clickable={false}
            className="border-base-100 size-14 shrink-0 rounded-full border-2 object-cover shadow-md sm:size-16"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base-content truncate text-lg font-bold sm:text-xl">{fullName}</h2>
            {username && <p className="text-base-content/60 truncate text-sm">@{username}</p>}
          </div>
          <CloseButton />
        </div>
      </div>

      {/* Divider */}
      {(bio || hasContactInfo) && <div className="bg-base-300 h-px" />}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {bio && (
          <div className="mb-6">
            <h3 className="text-base-content/50 mb-2 text-sm font-semibold tracking-wide uppercase">
              About
            </h3>
            <p className="text-base-content/70 text-sm whitespace-pre-line sm:text-base">{bio}</p>
          </div>
        )}

        {hasContactInfo && (
          <div>
            <h3 className="text-base-content/50 mb-3 text-sm font-semibold tracking-wide uppercase">
              Links
            </h3>
            <div className="flex flex-col gap-2">{links.map(renderLinkItem)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
