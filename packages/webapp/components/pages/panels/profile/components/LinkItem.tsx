import React from 'react'
import { createRoot } from 'react-dom/client'
import { FaPhone, FaLink, FaEnvelope, FaTrash } from 'react-icons/fa'
import { SOCIAL_MEDIA_ICONS } from '../constants' // You'll need to move constants to a separate file
import { ILinkItem, ELinkType, ILinkMetadata } from '../types'

interface LinkItemProps {
  link: ILinkItem
  showDescription: { [key: string]: boolean }
  toggleDescription: (url: string) => void
  handleRemoveLink: (id: string) => void
}

const LINK_TYPE_ICONS: {
  [key in ELinkType]: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
} = {
  [ELinkType.Email]: FaEnvelope,
  [ELinkType.Simple]: FaLink,
  [ELinkType.Phone]: FaPhone,
  [ELinkType.Social]: FaLink
}

function rgbToHex(rgb: string): string {
  const result = rgb.match(/\d+/g)
  if (!result || result.length < 3) return '#000000' // default to black if parsing fails
  const [r, g, b] = result.slice(0, 3)
  return `#${((1 << 24) + (parseInt(r) << 16) + (parseInt(g) << 8) + parseInt(b)).toString(16).slice(1)}`
}

const LinkItem: React.FC<LinkItemProps> = ({
  link,
  showDescription,
  toggleDescription,
  handleRemoveLink
}) => {
  const bgStyle = link.metadata?.themeColor
    ? {
        backgroundColor: link.metadata.themeColor.startsWith('rgb')
          ? `${rgbToHex(link.metadata.themeColor)}10`
          : `${link.metadata.themeColor}10`
      }
    : undefined

  const Icon = getLinkIcon(link.url, link.type, link.metadata)
  return (
    <div
      style={bgStyle}
      className="group mb-3 w-full max-w-full rounded-lg border border-gray-200 bg-white/80 p-2 px-4 shadow-sm backdrop-blur-sm transition-all hover:border-gray-300 hover:shadow-md">
      <div className="flex w-full items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center">
          {Icon && (
            <div className="flex-shrink-0">
              <Icon
                className={`${link.type === ELinkType.Social ? 'size-8' : 'size-4'}`}
                style={{
                  color:
                    link.type === ELinkType.Social
                      ? SOCIAL_MEDIA_ICONS[new URL(link.url).hostname.replace('www.', '')]?.color
                      : 'text-gray-200'
                }}
              />
            </div>
          )}
          <div className="ml-3 min-w-0 flex-1">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={link.metadata?.title || link.url}
              className="block truncate font-medium text-gray-900 transition-colors hover:text-blue-600">
              {link.metadata?.title || link.url}
            </a>
            {link.metadata?.description && (
              <div className="min-w-0">
                <button
                  className="mt-4 text-xs text-blue-500 transition-colors hover:text-blue-700 md:mt-0"
                  onClick={() => toggleDescription(link.url)}>
                  {showDescription[link.url] ? 'Hide' : 'Show'} Description
                </button>
                {showDescription[link.url] && (
                  <p className="mt-2 break-words text-sm text-gray-600">
                    {link.metadata?.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          className="ml-4 flex-shrink-0 rounded-full p-2 text-gray-400 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 sm:opacity-100"
          onClick={() => handleRemoveLink(link.url)}
          title="Remove link">
          <FaTrash className="size-4" />
        </button>
      </div>
    </div>
  )
}

export default LinkItem

const getLinkIcon = (
  url: string,
  type: ELinkType,
  metadata?: ILinkMetadata
): React.ComponentType<{ className?: string; style?: React.CSSProperties }> => {
  if (type === ELinkType.Email || type === ELinkType.Phone) {
    return LINK_TYPE_ICONS[type]
  }

  // Handle social media links first
  if (type === ELinkType.Social) {
    try {
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`
      const parsedUrl = new URL(formattedUrl)
      const domain = parsedUrl.hostname.replace('www.', '').toLowerCase()
      return SOCIAL_MEDIA_ICONS[domain]?.icon || LINK_TYPE_ICONS[ELinkType.Social]
    } catch {
      return LINK_TYPE_ICONS[ELinkType.Social]
    }
  }

  // Handle simple links with metadata
  if (type === ELinkType.Simple && metadata?.icon) {
    return () => (
      <div className="relative size-6 flex-shrink-0">
        <img
          src={metadata.icon}
          alt="site icon"
          className="size-6 rounded object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const DefaultIcon = LINK_TYPE_ICONS[ELinkType.Simple]
            const parent = e.currentTarget.parentElement
            if (parent) {
              const fallbackIcon = document.createElement('div')
              fallbackIcon.className = 'size-6 text-gray-500'
              parent.appendChild(fallbackIcon)
              const IconComponent = LINK_TYPE_ICONS[ELinkType.Simple]
              const root = createRoot(fallbackIcon)
              root.render(<IconComponent className="size-6 text-gray-500" />)
            }
          }}
        />
      </div>
    )
  }

  // Fallback to default simple icon
  return LINK_TYPE_ICONS[type]
}
