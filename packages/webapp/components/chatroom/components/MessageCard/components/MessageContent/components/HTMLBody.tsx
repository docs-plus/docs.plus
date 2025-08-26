import { useMessageCardContext } from '../../../MessageCardContext'
import { useMemo } from 'react'
import { sanitizeMessageContent } from '@utils/index'

export const HTMLBody = () => {
  const { message } = useMessageCardContext()

  const sanitizedHtml = useMemo(() => {
    if (!message.html) return message.content
    const { sanitizedHtml, sanitizedText } = sanitizeMessageContent(
      message.html,
      message.content || ''
    )
    return sanitizedHtml || sanitizedText || message.content || ''
  }, [message.html, message.content])

  return (
    <div
      className="message--card__content prose-slate prose-invert max-w-full overflow-hidden text-wrap break-words wrap-anywhere whitespace-pre-line whitespace-pre-wrap"
      dir="auto"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml || '' }}
    />
  )
}
