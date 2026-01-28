import { useState } from 'react'
import { MdAdd, MdDelete, MdLink, MdEmail, MdPhone, MdOpenInNew } from 'react-icons/md'
import { useAuthStore } from '@stores'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import * as toast from '@components/toast'
import { useProfileUpdate } from './hooks/useProfileUpdate'
import { SOCIAL_MEDIA_ICONS, SOCIAL_MEDIA_DOMAINS } from './constants'
import { ILinkItem, ELinkType } from './types'
import type { Profile } from '@types'

// Link validation helper
const validateLink = (url: string): { valid: boolean; type?: ELinkType; error?: string } => {
  const trimmedUrl = url.trim()

  // Phone number detection
  const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,}\)?[-.\s]?\d{1,}[-.\s]?\d{1,}$/
  if (phoneRegex.test(trimmedUrl.replace(/\s+/g, ''))) {
    return { valid: true, type: ELinkType.Phone }
  }

  // Email detection
  if (/^mailto:/.test(trimmedUrl) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUrl)) {
    return { valid: true, type: ELinkType.Email }
  }

  // URL validation
  try {
    const formattedUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`
    const parsedUrl = new URL(formattedUrl)
    const domain = parsedUrl.hostname.replace('www.', '').toLowerCase()
    const type = SOCIAL_MEDIA_DOMAINS.includes(domain) ? ELinkType.Social : ELinkType.Simple
    return { valid: true, type }
  } catch {
    return { valid: false, error: 'Invalid URL format!' }
  }
}

// Get icon for link type
const getLinkIcon = (link: ILinkItem) => {
  if (link.type === ELinkType.Email) return MdEmail
  if (link.type === ELinkType.Phone) return MdPhone

  if (link.type === ELinkType.Social) {
    try {
      const formattedUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`
      const domain = new URL(formattedUrl).hostname.replace('www.', '').toLowerCase()
      return SOCIAL_MEDIA_ICONS[domain]?.icon || MdLink
    } catch {
      return MdLink
    }
  }

  return MdLink
}

// Get formatted href for link
const getFormattedHref = (link: ILinkItem): string => {
  switch (link.type) {
    case ELinkType.Email:
      return link.url.startsWith('mailto:') ? link.url : `mailto:${link.url}`
    case ELinkType.Phone:
      return link.url.startsWith('tel:') ? link.url : `tel:${link.url}`
    default:
      return link.url.startsWith('http') ? link.url : `https://${link.url}`
  }
}

// Get icon color for social links
const getIconColor = (link: ILinkItem): string | undefined => {
  if (link.type !== ELinkType.Social) return undefined
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

  const links = (user?.profile_data?.linkTree ?? []) as ILinkItem[]

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

      const link: ILinkItem = {
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

  const handleLinkClick = (e: React.MouseEvent, link: ILinkItem) => {
    if (link.type === ELinkType.Phone || link.type === ELinkType.Email) {
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
          startIcon={!isLoading ? MdAdd : undefined}
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
                className="bg-base-200 hover:bg-base-300 group flex items-center gap-3 rounded-xl p-2.5 transition-all">
                {/* Icon */}
                <div className="bg-base-100 flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
                  {link.type === ELinkType.Simple && link.metadata?.icon ? (
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
                      className={`size-4 ${link.type === ELinkType.Social ? '' : 'text-base-content/60'}`}
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
                    {link.type !== ELinkType.Email && link.type !== ELinkType.Phone && (
                      <MdOpenInNew size={14} className="text-base-content/50 shrink-0" />
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
                  startIcon={MdDelete}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {links.length === 0 && (
        <div className="border-base-300 flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-6 text-center">
          <div className="bg-base-200 mb-2 flex size-10 items-center justify-center rounded-full">
            <MdLink size={20} className="text-base-content/50" />
          </div>
          <p className="text-base-content text-xs font-medium">No links added yet</p>
          <p className="text-base-content/50 mt-0.5 text-xs">Add your social profiles above</p>
        </div>
      )}
    </div>
  )
}

export default SocialLinks
