import { addMessageLinkIcons } from '@components/chatroom/utils/messageLinkIcons'
import { padNavigate } from '@components/TipTap/hyperlinkPopovers/hrefEventHandler'
import { previewLinkOutsideEditor } from '@components/TipTap/hyperlinkPopovers/previewHyperlink'
import { hasMod, isSafeHref } from '@docs.plus/extension-hyperlink'
import { getSanitizedMessageBodyHtml } from '@utils/index'
import { useLayoutEffect, useMemo, useRef } from 'react'

import { useMessageCardContext } from '../../../MessageCardContext'

const linkFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
  const anchor = (event.target as HTMLElement | null)?.closest?.<HTMLAnchorElement>('a[href]')
  const href = anchor?.getAttribute('href')?.trim()
  return anchor && href ? { anchor, href } : null
}

// As in the pad: a plain click previews, and Mod-click opens a new tab.
function onLinkClick(event: React.MouseEvent<HTMLDivElement>) {
  const link = linkFromEvent(event)
  if (!link) return
  event.preventDefault()
  event.stopPropagation()
  if (hasMod(event)) {
    padNavigate(link.href, { newTab: true })
    return
  }
  // A keyboard click has `detail` 0, so focus moves into the preview.
  if (isSafeHref(link.href)) previewLinkOutsideEditor(link.anchor, link.href, event.detail === 0)
}

// The middle button opens a new tab through the same safety check as the pad.
function onLinkAuxClick(event: React.MouseEvent<HTMLDivElement>) {
  if (event.button !== 1) return
  const link = linkFromEvent(event)
  if (!link) return
  event.preventDefault()
  event.stopPropagation()
  padNavigate(link.href, { newTab: true })
}

export const HTMLBody = () => {
  const { message } = useMessageCardContext()
  const bodyRef = useRef<HTMLDivElement>(null)

  const sanitizedHtml = useMemo(
    () => getSanitizedMessageBodyHtml(message.html, message.content || ''),
    [message.html, message.content]
  )

  // React rewrites the inner HTML only when the string changes, so the icons stay until then.
  // A layout effect adds them before paint, so the list measures the row once.
  useLayoutEffect(() => {
    if (bodyRef.current) addMessageLinkIcons(bodyRef.current)
  }, [sanitizedHtml])

  return (
    <div
      ref={bodyRef}
      className="message--card__content max-w-full overflow-hidden text-wrap break-words wrap-anywhere whitespace-pre-wrap [&_a]:cursor-pointer"
      dir="auto"
      onClick={onLinkClick}
      onAuxClick={onLinkAuxClick}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
