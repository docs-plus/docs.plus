import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { CHAT_MEDIA_MAX_WIDTH_CLASS } from '@components/chatroom/utils/messageMediaPaths'
import { messageMediaTheme } from '@components/chatroom/utils/messageMediaTheme'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { type MouseEvent, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { MediaUnavailable } from './MediaUnavailable'

type Props = {
  media: MessageMediaItem
  onOpen?: () => void
}

export function MessageMediaVideo({ media, onOpen }: Props) {
  const theme = messageMediaTheme('video')
  const { url: resolvedUrl, ref: visibilityRef, signFailed, retry } = useFeedMediaDisplayUrl(media)

  const onExpand = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (resolvedUrl) onOpen?.()
    },
    [onOpen, resolvedUrl]
  )

  return (
    <div
      ref={visibilityRef}
      className={twMerge(
        'group/video relative overflow-hidden rounded-lg border bg-black',
        CHAT_MEDIA_MAX_WIDTH_CLASS,
        theme.cardBorder
      )}>
      {resolvedUrl && !signFailed ? (
        <>
          <video src={resolvedUrl} controls playsInline className="max-h-[350px] w-full" />
          {onOpen ? (
            <button
              type="button"
              onClick={onExpand}
              className="btn btn-circle btn-xs bg-base-content/60 text-base-100 absolute top-2 right-2 border-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/video:opacity-100 sm:focus-visible:opacity-100"
              aria-label="Expand video">
              <Icons.maximize2 size={14} />
            </button>
          ) : null}
        </>
      ) : signFailed ? (
        <MediaUnavailable
          kind="video"
          label="Video unavailable"
          className="text-base-100 p-4"
          onRetry={retry}
        />
      ) : (
        <div className="skeleton min-h-[120px] w-full" aria-hidden />
      )}
    </div>
  )
}
