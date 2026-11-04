import { Icons } from '@components/icons/registry'
import CopyButton from '@components/ui/CopyButton'
import { getSiteIconUrl } from '@utils/link-helpers'
import { useState } from 'react'

import { ICON_SIZE } from './HovercardParts'

// Same origin as the app, so no icon route and no third party (CSP img-src 'self').
const LOGO_SRC = '/icons/logo.svg'
const ICON_CLASS = 'size-4 shrink-0 rounded-full'

/** The docs.plus logo for a pad link, else the site icon from our icon route. A miss shows none. */
function LinkIcon({ href, pad }: { href: string; pad: boolean }) {
  const [failed, setFailed] = useState(false)
  const src = pad ? LOGO_SRC : getSiteIconUrl(href)
  if (!src || failed) return null
  return <img src={src} alt="" aria-hidden onError={() => setFailed(true)} className={ICON_CLASS} />
}

/** Host, then path, query and hash, decoded for reading. The copy keeps the raw href. */
const linkParts = (href: string): { host: string; rest: string } => {
  try {
    const url = new URL(href, window.location.origin)
    const raw = `${url.pathname}${url.search}${url.hash}`
    let rest = raw
    try {
      rest = decodeURI(raw)
    } catch {
      // A malformed escape stays as written.
    }
    return { host: url.host, rest: rest === '/' ? '' : rest }
  } catch {
    return { host: href, rest: '' }
  }
}

type Props = {
  href: string
  /** A docs.plus link (`pad` or `here`): the line shows the docs.plus logo. */
  pad: boolean
  onOpen: (newTab: boolean) => void
}

/** The last row of both link hovercards: icon, host and path, Copy link, Open in new tab. */
export function HovercardLinkLine({ href, pad, onOpen }: Props) {
  const { host, rest } = linkParts(href)
  return (
    <div className="text-meta border-base-300 flex min-h-10 min-w-0 items-center gap-2 border-t py-1 pr-1 pl-3">
      <LinkIcon href={href} pad={pad} />
      <span className="text-base-content/70 min-w-0 flex-1 truncate">
        <span className="text-base-content">{host}</span>
        {rest}
      </span>
      {/* Tab stays in the editor (it indents there), so no card control joins the Tab order. */}
      <CopyButton
        text={href}
        square
        tabIndex={-1}
        label="Copy link"
        successLabel="Link copied"
        successMessage={null}
        className="text-base-content/70 hover:text-base-content shrink-0"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open in new tab"
        onClick={() => onOpen(true)}
        className="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-base-content shrink-0">
        <Icons.externalLink size={ICON_SIZE} aria-hidden className="stroke-[1.75]" />
      </button>
    </div>
  )
}
