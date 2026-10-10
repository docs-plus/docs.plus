import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import {
  attachmentExtensionLabel,
  formatAttachmentSize
} from '@components/chatroom/utils/messageMediaPaths'
import { messageMediaTheme } from '@components/chatroom/utils/messageMediaTheme'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { copyToClipboard } from '@utils/clipboard'
import { twMerge } from '@utils/twMerge'
import { type MouseEvent, useCallback } from 'react'

export function MessageMediaFileCard({ media }: { media: MessageMediaItem }) {
  const theme = messageMediaTheme('file')
  const label = media.name?.trim() || 'File'
  const ext = attachmentExtensionLabel(media.name)
  const sizeLabel = media.size != null ? formatAttachmentSize(media.size) : null
  const { url: resolvedUrl, ref: visibilityRef, signFailed, retry } = useFeedMediaDisplayUrl(media)

  const onCopyLink = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (resolvedUrl) void copyToClipboard(resolvedUrl)
    },
    [resolvedUrl]
  )

  return (
    <div
      ref={visibilityRef}
      className={twMerge(
        'hover:bg-base-200 rounded-field flex max-w-sm items-center gap-3 border px-3 py-2.5 transition-colors',
        theme.cardBorder,
        theme.cardSurface
      )}>
      <a
        href={resolvedUrl ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3"
        onClick={(e) => e.stopPropagation()}>
        <div
          className={twMerge(
            'rounded-field flex size-10 shrink-0 flex-col items-center justify-center',
            theme.iconBg
          )}>
          <Icons.fileText size={16} className={theme.accent} aria-hidden />
          <span
            className={twMerge('mt-0.5 text-[9px] leading-none font-bold uppercase', theme.accent)}>
            {ext}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          {sizeLabel ? <p className="text-base-content/60 text-xs">{sizeLabel}</p> : null}
        </div>
      </a>
      {resolvedUrl && !signFailed ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square shrink-0"
          aria-label={`Copy link for ${label}`}
          onClick={onCopyLink}>
          <Icons.link size={16} aria-hidden />
        </button>
      ) : signFailed ? (
        <Button
          variant="quiet"
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation()
            retry()
          }}>
          Retry
        </Button>
      ) : (
        <div className="skeleton rounded-field size-6 shrink-0" aria-hidden />
      )}
    </div>
  )
}
