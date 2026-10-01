import { fetchLinkMetadata } from '@api'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import { EmptyState } from '@components/ui/EmptyState'
import TextInput from '@components/ui/TextInput'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { getFormattedHref, getGoogleFaviconUrl } from '@utils/link-helpers'
import { useCallback, useId, useMemo, useState } from 'react'
import { LuExternalLink, LuLink, LuMail, LuPhone, LuPlus, LuTrash2 } from 'react-icons/lu'

import { MAX_LINKS, MIN_PHONE_DIGITS } from '../constants'
import type { useProfileUpdate } from '../hooks/useProfileUpdate'
import type { LinkItem, LinkMetadata } from '../types'
import { LinkType } from '../types'
import { getSocialColor, isSocialDomain } from '../utils/socialIcons'
import SocialIcon from './SocialIcon'

type ValidateLinkResult = { valid: true; type: LinkType } | { valid: false; error: string }

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
  return { valid: false, error: 'Enter a valid URL, email, or phone number.' }
}

const getFallbackIcon = (link: LinkItem) => {
  if (link.type === LinkType.Email) return LuMail
  if (link.type === LinkType.Phone) return LuPhone
  return LuLink
}

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
  onSave: ReturnType<typeof useProfileUpdate>['handleSave']
  saveLoading: boolean
}

const SocialLinks = ({ onSave, saveLoading }: SocialLinksProps) => {
  const user = useAuthStore((state) => state.profile)

  const [newLink, setNewLink] = useState('')
  const [fetching, setFetching] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const addErrorId = useId()

  const links = useMemo<LinkItem[]>(
    () => (user?.profile_data?.linkTree as LinkItem[]) ?? [],
    [user?.profile_data?.linkTree]
  )
  const isLoading = fetching || saveLoading
  const isAtLimit = links.length >= MAX_LINKS

  // The list is the confirmation, so a save shows no success toast. A failure rolls back.
  const saveLinkTree = useCallback(
    (linkTree: LinkItem[]) => onSave({ profile_data: { linkTree } }),
    [onSave]
  )

  const handleAddLink = useCallback(async () => {
    if (!user) return
    if (!newLink.trim()) {
      setAddError('Enter a URL, email, or phone number.')
      return
    }

    const result = validateLink(newLink)
    if (!result.valid) {
      setAddError(result.error)
      return
    }
    const { type } = result

    if (isDuplicate(links, newLink)) {
      setAddError('You have already added this link.')
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

      if (await saveLinkTree([...links, link])) setNewLink('')
    } catch {
      toast.Error('Couldn’t add the link.')
    } finally {
      setFetching(false)
    }
  }, [user, newLink, links, saveLinkTree])

  const handleRemoveLink = useCallback(
    async (url: string) => {
      await saveLinkTree(links.filter((link) => link.url !== url))
    },
    [links, saveLinkTree]
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-end gap-4">
          <TextInput
            label="Add URL, email, or phone"
            labelPosition="above"
            placeholder="https://twitter.com/username"
            value={newLink}
            onChange={(e) => {
              setNewLink(e.target.value)
              setAddError(null)
            }}
            disabled={isLoading || isAtLimit}
            onKeyDown={handleKeyDown}
            error={!!addError}
            aria-describedby={addError ? addErrorId : undefined}
            wrapperClassName="flex-1"
          />
          {/* Quiet, not primary: the pane's one primary is Save changes. */}
          <Button
            onClick={handleAddLink}
            disabled={isLoading || isAtLimit}
            loading={isLoading}
            variant="quiet"
            startIcon={LuPlus}
            className="my-0 shrink-0">
            Add link
          </Button>
        </div>
        {addError && (
          <p
            id={addErrorId}
            role="alert"
            className="text-meta flex items-start gap-1.5 text-[var(--error-ink)]">
            <Icons.alert size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{addError}</span>
          </p>
        )}
      </div>

      {isAtLimit && (
        <p className="text-meta flex items-start gap-1.5 font-medium text-[var(--warning-ink)]">
          <Icons.alert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>Maximum of {MAX_LINKS} links reached.</span>
        </p>
      )}

      {links.length > 0 && (
        <div className="space-y-2">
          <p className="text-meta text-base-content font-semibold">
            Your links ({links.length}/{MAX_LINKS})
          </p>

          {links.map((link) => {
            const FallbackIcon = getFallbackIcon(link)
            const iconColor = getLinkIconColor(link)
            const faviconUrl = getFaviconUrl(link)
            const domain = link.type === LinkType.Social ? extractDomain(link.url) : null
            const hasBrandIcon = !!domain && !!iconColor

            return (
              // -mx-2 keeps the text on the card edge while the hover fill bleeds past it.
              <div
                key={link.url}
                className="group rounded-field hover:bg-base-200 -mx-2 flex items-center gap-3 px-2 py-1.5 transition-colors">
                <div aria-hidden className="flex size-5 shrink-0 items-center justify-center">
                  {hasBrandIcon && domain ? (
                    <SocialIcon
                      domain={domain}
                      size={20}
                      className="size-5"
                      style={{ color: iconColor }}
                    />
                  ) : faviconUrl ? (
                    <>
                      <img
                        src={faviconUrl}
                        alt=""
                        className="size-5 object-contain"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                      <span className="hidden items-center justify-center">
                        <FallbackIcon className="text-base-content/60 size-5" />
                      </span>
                    </>
                  ) : (
                    <FallbackIcon className="text-base-content/60 size-5" />
                  )}
                </div>

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
                    <p className="text-meta text-base-content/60 truncate">
                      {link.metadata.description}
                    </p>
                  )}
                </div>

                {/* Always shown on phones; on desktop it shows on row hover or keyboard focus. */}
                <Button
                  onClick={() => handleRemoveLink(link.url)}
                  variant="ghost"
                  size="xs"
                  shape="circle"
                  className="text-error hover:bg-error/10 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  title="Remove link"
                  aria-label={`Remove ${link.metadata?.title || link.url}`}
                  startIcon={LuTrash2}
                />
              </div>
            )
          })}
        </div>
      )}

      {links.length === 0 && (
        <EmptyState
          layout="inline"
          title="No links added yet."
          body="Add your social profiles above."
        />
      )}
    </div>
  )
}

export default SocialLinks
