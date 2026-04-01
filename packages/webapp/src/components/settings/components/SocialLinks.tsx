import { fetchLinkMetadata } from '@api'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import { useAuthStore } from '@stores'
import type { ProfileData } from '@types'
import { getFormattedHref, getGoogleFaviconUrl } from '@utils/link-helpers'
import { useCallback, useMemo, useState } from 'react'
import { LuExternalLink, LuLink, LuMail, LuPhone, LuPlus, LuTrash2 } from 'react-icons/lu'

import { getSocialColor, getSocialIcon, isSocialDomain } from '../constants'
import type { LinkItem, LinkMetadata } from '../types'
import { extractDomain, MAX_LINKS, normalizeUrl, validateLink } from '../types'

// --- Pure helper functions ---

/** Get the icon component for a link based on its type and domain. */
const getLinkIcon = (link: LinkItem) => {
  if (link.type === 'email') return LuMail
  if (link.type === 'phone') return LuPhone

  const domain = extractDomain(link.url)
  if (domain) {
    const brandIcon = getSocialIcon(domain)
    if (brandIcon) return brandIcon
  }

  return LuLink
}

/** Get the brand color for a social link, or undefined for non-social types. */
const getLinkIconColor = (link: LinkItem): string | undefined => {
  if (link.type !== 'social') return undefined
  const domain = extractDomain(link.url)
  return domain ? getSocialColor(domain) : undefined
}

/** Check if a URL already exists in the links list (normalized comparison). */
const isDuplicate = (links: LinkItem[], url: string): boolean => {
  const normalized = normalizeUrl(url)
  return links.some((l) => normalizeUrl(l.url) === normalized)
}

/** Get a favicon URL for a link (skips email/phone — no favicon needed). */
const getFaviconUrl = (link: LinkItem): string | undefined => {
  if (link.type === 'email' || link.type === 'phone') return undefined
  return getGoogleFaviconUrl(link.url)
}

// --- Props ---

interface SocialLinksProps {
  /** Save handler from parent (single save channel — SOLID SRP). */
  onSave: (options?: { successToast?: string; skipUsernameValidation?: boolean }) => Promise<void>
  /** Whether a save operation is in progress. */
  saveLoading: boolean
}

// --- Component ---

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

  // --- Handlers ---

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

  const handleAddLink = useCallback(async () => {
    if (!user || !newLink.trim()) return

    if (isAtLimit) {
      toast.Warning(`You can add up to ${MAX_LINKS} links.`)
      return
    }

    const { valid, type, error } = validateLink(newLink, isSocialDomain)
    if (!valid) {
      toast.Error(error || 'Invalid link')
      return
    }

    if (isDuplicate(links, newLink)) {
      toast.Warning('Link already exists!')
      return
    }

    setFetching(true)

    // Capture state for rollback
    const previousLinks = links

    try {
      // Fetch metadata for URLs (skip for phone/email — no OG tags)
      const metadata: LinkMetadata =
        type === 'phone' || type === 'email'
          ? { title: newLink.trim() }
          : await fetchLinkMetadata(newLink.trim())

      const link: LinkItem = {
        url: newLink.trim(),
        type: type!,
        metadata
      }

      const newLinkTree = [...links, link]
      updateLinkTree(newLinkTree)

      // Only clear input after successful save
      try {
        await onSave({ successToast: 'Link added successfully!', skipUsernameValidation: true })
        setNewLink('')
      } catch {
        // Rollback optimistic update
        updateLinkTree(previousLinks)
        toast.Error('Failed to save link. Please try again.')
      }
    } catch {
      toast.Error('An error occurred while adding the link.')
    } finally {
      setFetching(false)
    }
  }, [user, newLink, links, isAtLimit, updateLinkTree, onSave])

  const handleRemoveLink = useCallback(
    async (url: string) => {
      if (!user) return

      // Capture state for rollback
      const previousLinks = links
      const newLinkTree = links.filter((link) => link.url !== url)
      updateLinkTree(newLinkTree)

      try {
        await onSave({ successToast: 'Link removed successfully!', skipUsernameValidation: true })
      } catch {
        // Rollback optimistic update
        updateLinkTree(previousLinks)
        toast.Error('Failed to remove link. Please try again.')
      }
    },
    [user, links, updateLinkTree, onSave]
  )

  const handleLinkClick = useCallback((e: React.MouseEvent, link: LinkItem) => {
    if (link.type === 'phone' || link.type === 'email') {
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

  // --- Render ---

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
            const Icon = getLinkIcon(link)
            const iconColor = getLinkIconColor(link)
            const faviconUrl = getFaviconUrl(link)
            const hasBrandIcon = link.type === 'social' && !!iconColor

            return (
              <div
                key={link.url}
                className="bg-base-200 hover:bg-base-300 group rounded-box flex items-center gap-3 p-2.5 transition-all">
                {/* Icon — brand icon for known socials, Google favicon for other URLs, Lu* for email/phone */}
                <div className="bg-base-100 rounded-field flex size-8 shrink-0 items-center justify-center shadow-sm">
                  {/* For known social domains, show brand icon directly (no need for favicon) */}
                  {hasBrandIcon ? (
                    <Icon className="size-4" style={{ color: iconColor }} />
                  ) : faviconUrl ? (
                    /* For URL-based links, use Google Favicon Service (always returns valid PNG) */
                    <>
                      <img
                        src={faviconUrl}
                        alt=""
                        className="size-5 rounded-sm object-contain"
                        loading="lazy"
                        onError={(e) => {
                          // Hide broken favicon — fallback icon renders underneath
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                      {/* Fallback: generic icon if Google favicon also fails (extremely rare) */}
                      <span className="hidden items-center justify-center">
                        <Icon className="text-base-content/60 size-4" />
                      </span>
                    </>
                  ) : (
                    /* Email / Phone — use Lucide icon */
                    <Icon className="text-base-content/60 size-4" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <a
                    href={getFormattedHref(link)}
                    onClick={(e) => handleLinkClick(e, link)}
                    className="text-base-content hover:text-primary flex items-center gap-1 truncate text-sm font-medium transition-colors">
                    {link.metadata?.title || link.url}
                    {link.type !== 'email' && link.type !== 'phone' && (
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
