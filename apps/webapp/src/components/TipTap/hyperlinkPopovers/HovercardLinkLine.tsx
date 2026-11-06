import { Icons } from '@components/icons/registry'
import CopyButton from '@components/ui/CopyButton'
import { attachTooltip } from '@docs.plus/extension-hyperlink'
import { getSiteIconUrl } from '@utils/link-helpers'
import { twMerge } from '@utils/twMerge'
import { useState } from 'react'

import { ICON_SIZE } from './HovercardParts'
import { linkParts } from './linkParts'

// Same origin as the app, so no icon route and no third party (CSP img-src 'self').
const LOGO_SRC = '/icons/logo.svg'

/** The docs.plus logo for a pad link, else the site icon from our icon route. A miss shows none. */
export function LinkIcon({
  href,
  pad,
  className
}: {
  href: string
  pad: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = pad ? LOGO_SRC : getSiteIconUrl(href)
  if (!src || failed) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      className={twMerge('size-4 shrink-0 rounded-full', className)}
    />
  )
}

/**
 * The `attachTooltip` bubble, because the card rules ban the house `Tooltip`. It reads the
 * label at mount. One stable ref, so a re-render does not detach and hide a bubble on screen.
 */
const bubble = (button: HTMLButtonElement | null) =>
  button ? attachTooltip(button, button.getAttribute('aria-label') ?? '') : undefined

type Props = {
  href: string
  /** A docs.plus link (`pad` or `here`): the line shows the docs.plus logo. */
  pad: boolean
  /** Replaces the address when the card body already shows it: why there is no preview. */
  reason?: string
  /** Set by the engine only when the link text is its own URL and the pad is editable. */
  onApplyTitle?: () => void
  onOpen: (newTab: boolean) => void
}

/** The last row of every link hovercard: the address or a reason, then its actions. */
export function HovercardLinkLine({ href, pad, reason, onApplyTitle, onOpen }: Props) {
  const address = reason ? null : linkParts(href)
  return (
    <div className="text-meta border-base-300 flex min-h-10 min-w-0 items-center gap-2 border-t py-1 pr-1 pl-3">
      {address ? (
        <>
          <LinkIcon href={href} pad={pad} />
          <span className="text-base-content/70 min-w-0 flex-1 truncate">
            <span className="text-base-content">{address.host}</span>
            {address.rest}
          </span>
        </>
      ) : (
        <span className="text-base-content/60 min-w-0 flex-1">{reason}</span>
      )}
      {/* Tab stays in the editor (it indents there), so no card control joins the Tab order. */}
      {onApplyTitle && (
        <button
          ref={bubble}
          type="button"
          tabIndex={-1}
          aria-label="Use page title"
          onClick={onApplyTitle}
          className="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-base-content shrink-0">
          <Icons.textFormat size={ICON_SIZE} aria-hidden className="stroke-[1.75]" />
        </button>
      )}
      <CopyButton
        ref={bubble}
        text={href}
        square
        tabIndex={-1}
        label="Copy link"
        successLabel="Link copied"
        successMessage={null}
        className="text-base-content/70 hover:text-base-content shrink-0"
      />
      <button
        ref={bubble}
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
