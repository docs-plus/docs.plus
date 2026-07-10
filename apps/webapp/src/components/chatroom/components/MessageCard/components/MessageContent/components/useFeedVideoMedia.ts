import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { positiveMediaDims } from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem } from '@types'
import { type SyntheticEvent, useCallback } from 'react'

/** Shared signed-URL + metadata path for feed video poster and inline player. */
export function useFeedVideoMedia(
  media: MessageMediaItem,
  onDimensions?: (width: number, height: number) => void
) {
  const { url: resolvedUrl, ref: visibilityRef, signFailed, retry } = useFeedMediaDisplayUrl(media)

  const handleMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const dims = positiveMediaDims(
        event.currentTarget.videoWidth,
        event.currentTarget.videoHeight
      )
      if (dims) onDimensions?.(dims.width, dims.height)
    },
    [onDimensions]
  )

  return { resolvedUrl, visibilityRef, signFailed, retry, handleMetadata }
}
