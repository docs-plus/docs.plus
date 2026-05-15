import { fetchLinkMetadata } from '@api'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import { useAuthStore } from '@stores'
import type { ProfileData } from '@types'
import { getFormattedHref, getGoogleFaviconUrl } from '@utils/link-helpers'
import { useCallback, useMemo, useState } from 'react'
import { LuExternalLink, LuLink, LuMail, LuPhone, LuPlus, LuTrash2 } from 'react-icons/lu'

import { MAX_LINKS, MIN_PHONE_DIGITS } from '../constants'
import type { LinkItem, LinkMetadata } from '../types'
import { LinkType } from '../types'
import { getSocialColor, isSocialDomain } from '../utils/socialIcons'
import SocialIcon from './SocialIcon'

type ValidateLinkResult = { valid: true; type: LinkType } | { valid: false; error: string }

/** Lowercase hostname, ensure protocol, strip trailing slash. */
const normalizeUrl = (url: string): string => {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    const parsed = new URL(withProtocol)
    parsed.hostname = parsed.hostname.toLowerCase()
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return url.trim().toLowerCase()
  }
}

/** Bare hostname for a URL (no www., lowercased). */
const extractDomain = (url: string): string | null => {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    return new URL(withProtocol).hostname.replace('www.', '').toLowerCase()
  } catch {
    return null
  }
}

const PHONE_REGEX = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,}\)?[-.\s]?\d{1,}[-.\s]?\d{1,}$/

const validateLink = (url: string): ValidateLinkResult => {
  const trimmed = url.trim()
  const digitsOnly = trimmed.replace(/\D/g, '')
  if (PHONE_REGEX.test(trimmed.replace(/\s+/g, '')) && digitsOnly.length >= MIN_PHONE_DIGITS) {
    return { valid: true, type: LinkType.Phone }
  }
  if (/^mailto:/.test(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: true, type: LinkType.Email }
  }
  const domain = extractDomain(trimmed)
  if (domain) {
    return { valid: true, type: isSocialDomain(domain) ? LinkType.Social : LinkType.Simple }
  }
  return { valid: false, error: 'Invalid URL format!' }
}

/** Get the leading Lu* icon for non-social link types. */
const getFallbackIcon = (link: LinkItem) => {
  if (link.type === LinkType.Email) return LuMail
  if (link.type === LinkType.Phone) return LuPhone
  return LuLink
}

/** Brand colour for known social domains; undefined otherwise. */
const getLinkIconColor = (link: LinkItem): string | undefined => {
  if (link.type !== LinkType.Social) return undefined
  const domain = extractDomain(link.url)
  return domain ? getSocialColor(domain) : undefined
}

const isDuplicate = (links: LinkItem[], url: string): boolean => {
  const normalized = normalizeUrl(url)
  return links.some((l) => normalizeUrl(l.url) === normalized)
}

const getFaviconUrl = (link: LinkItem): string | undefined => {
  if (link.type === LinkType.Email || link.type === LinkType.Phone) return undefined
  return getGoogleFaviconUrl(link.url)
}

interface SocialLinksProps {
  onSave: (options?: { successToast?: string; skipUsernameValidation?: boolean }) => Promise<void>
  saveLoading: boolean
}

const SocialLinks = ({ onSave, saveLoading }: SocialLinksProps) => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)

  const [newLink, setNewLink] = useState('')
  const [fetching, setFetching] = useState(false)

  const links = useMemo<LinkItem[]>(
    () => (user?.profile_data?.linkTree as LinkItem[]) ?? [],
    [user?.profile_data?.linkTree]
  )
  const isLoading = fetching || saveLoading
  const isAtLimit = links.length >= MAX_LINKS

  const updateLinkTree = useCallback(
    (newLinkTree: LinkItem[]) => {
      if (!user) return
      setProfile({
        ...user,
        profile_data: { ...(user.profile_data as ProfileData), linkTree: newLinkTree }
      })
    },
    [user, setProfile]
  )

  // Optimistic — onSave failures surface a toast but the local tree
  // already shows the change; the next profile fetch reconciles.
  const handleAddLink = useCallback(async () => {
    if (!user || !newLink.trim()) return

    if (isAtLimit) {
      toast.Warning(`You can add up to ${MAX_LINKS} links.`)
      return
    }

    const result = validateLink(newLink)
    if (!result.valid) {
      toast.Error(result.error)
      return
    }
    const { type } = result

    if (isDuplicate(links, newLink)) {
      toast.Warning('Link already exists!')
      return
    }

    setFetching(true)

    try {
      // Skip metadata fetch for phone/email — no OG tags to read.
      const metadata: LinkMetadata =
        type === LinkType.Phone || type === LinkType.Email
          ? { title: newLink.trim() }
          : await fetchLinkMetadata(newLink.trim())

      const link: LinkItem = {
        url: newLink.trim(),
        type,
        metadata
      }

      updateLinkTree([...links, link])
      await onSave({ successToast: 'Link added successfully!', skipUsernameValidation: true })
      setNewLink('')
    } catch {
      toast.Error('An error occurred while adding the link.')
    } finally {
      setFetching(false)
    }
  }, [user, newLink, links, isAtLimit, updateLinkTree, onSave])

  const handleRemoveLink = useCallback(
    async (url: string) => {
      if (!user) return
      updateLinkTree(links.filter((link) => link.url !== url))
      await onSave({ successToast: 'Link removed successfully!', skipUsernameValidation: true })
    },
    [user, links, updateLinkTree, onSave]
  )

  const handleLinkClick = useCallback((e: React.MouseEvent, link: LinkItem) => {
    if (link.type === LinkType.Phone || link.type === LinkType.Email) {
      return // Let default browser behavior handle tel:/mailto:
    }
    e.preventDefault()
    window.open(getFormattedHref(link), '_blank', 'noopener,noreferrer')
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleAddLink()
    },
    [handleAddLink]
  )

  return (
    <div className="space-y-3">
      {/* Add link input */}
      <div className="flex gap-2">
        <TextInput
          label="Add URL, email, or phone"
          labelPosition="floating"
          placeholder="https://twitter.com/username"
          value={newLink}
          onChange={(e) => setNewLink(e.target.value)}
          disabled={isLoading || isAtLimit}
          onKeyDown={handleKeyDown}
          wrapperClassName="flex-1"
        />
        <Button
          onClick={handleAddLink}
          disabled={isLoading || !newLink.trim() || isAtLimit}
          loading={isLoading}
          variant="primary"
          startIcon={!isLoading ? LuPlus : undefined}
          className="mt-auto min-w-10 px-3"
          aria-label="Add link"
        />
      </div>

      {/* Link limit hint */}
      {isAtLimit && (
        <p className="text-warning text-xs font-medium">Maximum of {MAX_LINKS} links reached.</p>
      )}

      {/* Links list */}
      {links.length > 0 && (
        <div className="space-y-2">
          <p className="text-base-content/50 text-xs font-medium">
            Your Links ({links.length}/{MAX_LINKS})
          </p>

          {links.map((link) => {
            const FallbackIcon = getFallbackIcon(link)
            const iconColor = getLinkIconColor(link)
            const faviconUrl = getFaviconUrl(link)
            const domain = link.type === LinkType.Social ? extractDomain(link.url) : null
            const hasBrandIcon = !!domain && !!iconColor

            return (
              <div
                key={link.url}
                className="bg-base-200 hover:bg-base-300 group rounded-box flex items-center gap-3 p-2.5 transition-all">
                <div className="bg-base-100 rounded-field flex size-8 shrink-0 items-center justify-center shadow-sm">
                  {hasBrandIcon && domain ? (
                    <SocialIcon domain={domain} className="size-4" style={{ color: iconColor }} />
                  ) : faviconUrl ? (
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
                        <FallbackIcon className="text-base-content/60 size-4" />
                      </span>
                    </>
                  ) : (
                    <FallbackIcon className="text-base-content/60 size-4" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <a
                    href={getFormattedHref(link)}
                    onClick={(e) => handleLinkClick(e, link)}
                    className="text-base-content hover:text-primary flex items-center gap-1 truncate text-sm font-medium transition-colors">
                    {link.metadata?.title || link.url}
                    {link.type !== LinkType.Email && link.type !== LinkType.Phone && (
                      <LuExternalLink size={14} className="text-base-content/50 shrink-0" />
                    )}
                  </a>
                  {link.metadata?.description && (
                    <p className="text-base-content/60 truncate text-xs">
                      {link.metadata.description}
                    </p>
                  )}
                </div>

                {/* Remove button — visible on mobile, hover-reveal on desktop */}
                <Button
                  onClick={() => handleRemoveLink(link.url)}
                  variant="ghost"
                  size="xs"
                  shape="circle"
                  className="text-base-content/50 hover:bg-error/10 hover:text-error opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                  title="Remove link"
                  aria-label={`Remove ${link.metadata?.title || link.url}`}
                  startIcon={LuTrash2}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state — aligned with design system §5.6 */}
      {links.length === 0 && (
        <div className="border-base-300 rounded-box flex flex-col items-center justify-center border-2 border-dashed py-6 text-center">
          <div className="bg-base-200 mb-2 flex size-12 items-center justify-center rounded-full">
            <LuLink size={24} className="text-base-content/40" />
          </div>
          <p className="text-base-content/60 text-sm font-medium">No links added yet</p>
          <p className="text-base-content/40 mt-0.5 text-sm">Add your social profiles above</p>
        </div>
      )}
    </div>
  )
}

export default SocialLinks
