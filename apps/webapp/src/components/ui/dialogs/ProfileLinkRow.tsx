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

export function ProfileLinkRow({ link }: { link: SanitizedProfileLink }) {
  return (
    <a
      {...profileLinkAnchorProps(link)}
      className="bg-base-200/80 hover:bg-base-300 flex items-center gap-3 rounded-xl p-3 transition-colors duration-150">
      <span className="bg-base-100 ring-base-300/60 flex size-9 shrink-0 items-center justify-center rounded-full ring-1">
        <ProfileLinkIcon link={link} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-base-content block truncate text-sm font-medium">{link.title}</span>
        {link.description ? (
          <span className="text-base-content/60 block truncate text-xs">{link.description}</span>
        ) : null}
      </div>
    </a>
  )
}
