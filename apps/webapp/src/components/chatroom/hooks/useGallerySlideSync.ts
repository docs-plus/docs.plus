import { useChatMediaGalleryStore } from '@components/chatroom/stores/chatMediaGalleryStore'
import { type RefObject, useEffect } from 'react'

export function usePublishActiveResolvedUrl(isActive: boolean, url: string | null) {
  const setActiveResolvedUrl = useChatMediaGalleryStore((s) => s.setActiveResolvedUrl)

  useEffect(() => {
    if (!isActive) return
    setActiveResolvedUrl(url)
  }, [isActive, setActiveResolvedUrl, url])
}

export function usePauseMediaOnInactive(
  ref: RefObject<HTMLMediaElement | null>,
  isActive: boolean
) {
  useEffect(() => {
    if (!isActive) ref.current?.pause()
  }, [isActive, ref])
}
