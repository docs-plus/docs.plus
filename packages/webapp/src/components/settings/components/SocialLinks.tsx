import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import { useAuthStore } from '@stores'
import type { Profile } from '@types'
import { useState } from 'react'
import { LuExternalLink, LuLink, LuMail, LuPhone, LuPlus, LuTrash2 } from 'react-icons/lu'

import { SOCIAL_MEDIA_DOMAINS, SOCIAL_MEDIA_ICONS } from '../constants'
import { useProfileUpdate } from '../hooks/useProfileUpdate'
import { LinkItem, LinkType } from '../types'

// Link validation helper
const validateLink = (url: string): { valid: boolean; type?: LinkType; error?: string } => {
  const trimmedUrl = url.trim()

  // Phone number detection
  const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,}\)?[-.\s]?\d{1,}[-.\s]?\d{1,}$/
  if (phoneRegex.test(trimmedUrl.replace(/\s+/g, ''))) {
    return { valid: true, type: LinkType.Phone }
  }

  // Email detection
  if (/^mailto:/.test(trimmedUrl) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUrl)) {
    return { valid: true, type: LinkType.Email }
  }

  // URL validation
  try {
    const formattedUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`
    const parsedUrl = new URL(formattedUrl)
    const domain = parsedUrl.hostname.replace('www.', '').toLowerCase()
    const type = SOCIAL_MEDIA_DOMAINS.includes(domain) ? LinkType.Social : LinkType.Simple
    return { valid: true, type }
  } catch {
    return { valid: false, error: 'Invalid URL format!' }
  }
}

// Get icon for link type
const getLinkIcon = (link: LinkItem) => {
  if (link.type === LinkType.Email) return LuMail
  if (link.type === LinkType.Phone) return LuPhone

  if (link.type === LinkType.Social) {
    try {
      const formattedUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`
      const domain = new URL(formattedUrl).hostname.replace('www.', '').toLowerCase()
      return SOCIAL_MEDIA_ICONS[domain]?.icon || LuLink
    } catch {
      return LuLink
    }
  }

  return LuLink
}

// Get formatted href for link
const getFormattedHref = (link: LinkItem): string => {
  switch (link.type) {
    case LinkType.Email:
      return link.url.startsWith('mailto:') ? link.url : `mailto:${link.url}`
    case LinkType.Phone:
      return link.url.startsWith('tel:') ? link.url : `tel:${link.url}`
    default:
      return link.url.startsWith('http') ? link.url : `https://${link.url}`
  }
}

// Get icon color for social links
const getIconColor = (link: LinkItem): string | undefined => {
  if (link.type !== LinkType.Social) return undefined
  try {
    const formattedUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`
    const domain = new URL(formattedUrl).hostname.replace('www.', '').toLowerCase()
    return SOCIAL_MEDIA_ICONS[domain]?.color
  } catch {
    return undefined
  }
}

const SocialLinks = () => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const { loading: updateLoading, handleSave } = useProfileUpdate()

  const [newLink, setNewLink] = useState('')
  const [loading, setLoading] = useState(false)

  const links = (user?.profile_data?.linkTree ?? []) as LinkItem[]

  const handleAddLink = async () => {
    if (!user || !newLink.trim()) return

    const { valid, type, error } = validateLink(newLink)
    if (!valid) {
      toast.Error(error || 'Invalid link')
      return
    }

    // Check for duplicates
    if (links.some((l) => l.url === newLink.trim())) {
      toast.Warning('Link already exists!')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/fetchMetadata?url=${encodeURIComponent(newLink.trim())}`)
      const metadata = await response.json()

      if (metadata.error) {
        toast.Error('Failed to fetch metadata')
        setLoading(false)
        return
      }

      const link: LinkItem = {
        url: newLink.trim(),
        type: type!,
        metadata
      }

      const newLinkTree = [...links, link]
      setProfile({
        ...user,
        profile_data: { ...user.profile_data, linkTree: newLinkTree }
      } as Profile)

      setNewLink('')
      await handleSave({ successToast: 'Link added successfully!' })
    } catch {
      toast.Error('An error occurred while fetching metadata')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveLink = async (url: string) => {
    if (!user) return

    const newLinkTree = links.filter((link) => link.url !== url)
    setProfile({
      ...user,
      profile_data: { ...user.profile_data, linkTree: newLinkTree }
    } as Profile)

    await handleSave({ successToast: 'Link removed successfully!' })
  }

  const handleLinkClick = (e: React.MouseEvent, link: LinkItem) => {
    if (link.type === LinkType.Phone || link.type === LinkType.Email) {
      return // Let default behavior handle these
    }
    e.preventDefault()
    window.open(getFormattedHref(link), '_blank', 'noopener,noreferrer')
  }

  const isLoading = loading || updateLoading

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
          disabled={isLoading}
          onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
          wrapperClassName="flex-1"
        />
        <Button
          onClick={handleAddLink}
          disabled={isLoading || !newLink.trim()}
          loading={isLoading}
          variant="primary"
          startIcon={!isLoading ? LuPlus : undefined}
          className="mt-auto min-w-10 px-3"
        />
      </div>

      {/* Links list */}
      {links.length > 0 && (
        <div className="space-y-2">
          <p className="text-base-content/50 text-xs font-medium">Your Links</p>

          {links.map((link) => {
            const Icon = getLinkIcon(link)
            const iconColor = getIconColor(link)

            return (
              <div
                key={link.url}
                className="bg-base-200 hover:bg-base-300 group rounded-box flex items-center gap-3 p-2.5 transition-all">
                {/* Icon */}
                <div className="bg-base-100 rounded-field flex size-8 shrink-0 items-center justify-center shadow-sm">
                  {link.type === LinkType.Simple && link.metadata?.icon ? (
                    <img
                      src={link.metadata.icon}
                      alt=""
                      className="size-4 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <Icon
                      className={`size-4 ${link.type === LinkType.Social ? '' : 'text-base-content/60'}`}
                      style={iconColor ? { color: iconColor } : undefined}
                    />
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

                {/* Remove button */}
                <Button
                  onClick={() => handleRemoveLink(link.url)}
                  variant="ghost"
                  size="xs"
                  shape="circle"
                  className="text-base-content/50 hover:bg-error/10 hover:text-error opacity-0 transition-opacity group-hover:opacity-100"
                  title="Remove link"
                  startIcon={LuTrash2}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state — aligned with design system pattern */}
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
