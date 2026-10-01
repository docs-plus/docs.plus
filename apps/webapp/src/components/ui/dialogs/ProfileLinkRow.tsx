import SocialIcon from '@components/settings/components/SocialIcon'
import { getSocialColor, isSocialDomain } from '@components/settings/utils/socialIcons'
import { getGoogleFaviconUrl } from '@utils/link-helpers'
import { LuLink, LuMail, LuPhone } from 'react-icons/lu'

import { profileLinkAnchorProps, type SanitizedProfileLink } from './profileLinks'

function ProfileLinkIcon({ link }: { link: SanitizedProfileLink }) {
  if (link.type === 'email') {
    return <LuMail className="text-base-content/60 size-5" aria-hidden="true" />
  }

  if (link.type === 'phone') {
    return <LuPhone className="text-base-content/60 size-5" aria-hidden="true" />
  }

  if (link.type === 'social') {
    try {
      const domain = new URL(link.url).hostname.replace('www.', '')
      if (isSocialDomain(domain)) {
        const color = getSocialColor(domain)
        return (
          <SocialIcon
            domain={domain}
            size={20}
            className="size-5"
            style={color ? { color } : undefined}
          />
        )
      }
    } catch {
      // fall through to favicon
    }
  }

  const faviconUrl = getGoogleFaviconUrl(link.url)
  if (faviconUrl) {
    return (
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
          <LuLink className="text-base-content/60 size-5" aria-hidden="true" />
        </span>
      </>
    )
  }

  return <LuLink className="text-base-content/60 size-5" aria-hidden="true" />
}

export function ProfileLinkRow({ link }: { link: SanitizedProfileLink }) {
  return (
    // -mx-2 keeps the text on the section edge while the hover fill bleeds past it.
    <a
      {...profileLinkAnchorProps(link)}
      className="rounded-field hover:bg-base-200 focus-visible:ring-primary -mx-2 flex items-center gap-3 px-2 py-1.5 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none">
      <span className="flex size-5 shrink-0 items-center justify-center">
        <ProfileLinkIcon link={link} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-base-content block truncate text-sm font-medium">{link.title}</span>
        {link.description ? (
          <span className="text-meta text-base-content/60 block truncate">{link.description}</span>
        ) : null}
      </div>
    </a>
  )
}
