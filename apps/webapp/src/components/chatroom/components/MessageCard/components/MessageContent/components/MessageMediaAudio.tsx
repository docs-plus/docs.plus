import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { messageMediaTheme } from '@components/chatroom/utils/messageMediaTheme'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { twMerge } from 'tailwind-merge'

import { MediaUnavailable } from './MediaUnavailable'

export function MessageMediaAudio({ media }: { media: MessageMediaItem }) {
  const theme = messageMediaTheme('audio')
  const label = media.name?.trim() || 'Audio attachment'
  const { url: resolvedUrl, ref: visibilityRef, signFailed, retry } = useFeedMediaDisplayUrl(media)

  return (
    <div
      ref={visibilityRef}
      className={twMerge(
        'flex max-w-sm items-center gap-2.5 rounded-lg border px-3 py-2.5',
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
        <p className={twMerge('truncate text-xs font-medium', theme.accent)}>{label}</p>
        {resolvedUrl && !signFailed ? (
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
    </div>
  )
}
