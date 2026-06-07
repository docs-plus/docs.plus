import { navigateHref } from '@components/TipTap/hyperlinkPopovers/hrefEventHandler'
import { getSanitizedMessageBodyHtml } from '@utils/index'
import { useMemo } from 'react'

import { useMessageCardContext } from '../../../MessageCardContext'

function openLinkFromClick(event: React.MouseEvent<HTMLDivElement>) {
  const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]')
  const href = anchor?.getAttribute('href')?.trim()
  if (!href) return
  event.preventDefault()
  event.stopPropagation()
  navigateHref(href)
}

export const HTMLBody = () => {
  const { message } = useMessageCardContext()

  const sanitizedHtml = useMemo(
    () => getSanitizedMessageBodyHtml(message.html, message.content || ''),
    [message.html, message.content]
  )

  return (
    <div
      className="message--card__content prose-slate prose-invert max-w-full overflow-hidden text-wrap break-words wrap-anywhere whitespace-pre-wrap [&_a]:cursor-pointer"
      dir="auto"
      onClick={openLinkFromClick}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
