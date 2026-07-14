import { FeedSpoilerRevealOverlay } from '@components/chatroom/components/MediaSpoilerReveal'
import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { useSpoilerGatedActivate } from '@components/chatroom/utils/feedSpoilerReveal'
import { messageMediaTheme } from '@components/chatroom/utils/messageMediaTheme'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { twMerge } from 'tailwind-merge'

import { MediaUnavailable } from './MediaUnavailable'

type Props = {
  media: MessageMediaItem
  onOpen?: () => void
}

export function MessageMediaAudio({ media, onOpen }: Props) {
  const theme = messageMediaTheme('audio')
  const label = media.name?.trim() || 'Audio attachment'
  const { url: resolvedUrl, ref: visibilityRef, signFailed, retry } = useFeedMediaDisplayUrl(media)
  const { isSpoiler, onActivate: onExpand } = useSpoilerGatedActivate(media, onOpen, {
    ready: Boolean(resolvedUrl),
    preventDefault: true
  })

  return (
    <div
      ref={visibilityRef}
      className={twMerge(
        'group/audio rounded-field relative flex max-w-sm items-center gap-2.5 border px-3 py-2.5',
        theme.cardBorder,
        theme.cardSurface
      )}>
      <div
        className={twMerge(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          theme.iconBg
        )}>
        <Icons.music size={18} className={theme.accent} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base-content truncate text-xs font-medium">{label}</p>
        {isSpoiler ? (
          <button
            type="button"
            className="rounded-field bg-base-300/40 relative mt-1 flex h-8 w-full min-w-[180px] cursor-pointer items-center justify-center overflow-hidden border-0 p-0"
            aria-label="Reveal spoiler audio"
            data-testid="feed-spoiler-reveal"
            onClick={onExpand}>
            <FeedSpoilerRevealOverlay />
          </button>
        ) : resolvedUrl && !signFailed ? (
          <audio controls preload="none" className="mt-1 h-8 w-full min-w-[180px]">
            <source src={resolvedUrl} />
          </audio>
        ) : signFailed ? (
          <MediaUnavailable
            kind="audio"
            label="Audio unavailable"
            className="mt-1 min-h-0 bg-transparent p-0"
            onRetry={retry}
          />
        ) : (
          <div className="skeleton mt-1 h-8 w-full min-w-[180px]" aria-hidden />
        )}
      </div>
      {!isSpoiler && onOpen && resolvedUrl && !signFailed ? (
        <button
          type="button"
          onClick={onExpand}
          className="btn btn-circle btn-xs bg-base-content/60 text-base-100 absolute top-2 right-2 border-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/audio:opacity-100 sm:focus-visible:opacity-100"
          aria-label="Expand audio">
          <Icons.maximize2 size={14} />
        </button>
      ) : null}
    </div>
  )
}
