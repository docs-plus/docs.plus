import { useVirtuosoLocation } from '@virtuoso.dev/message-list'
import { useEffect } from 'react'

/**
 * Footer-slot bridge: `useVirtuosoLocation` is only legal inside
 * VirtuosoMessageList descendants, so this lives in the list's Footer.
 */
export const AtBottomTracker = ({ onChange }: { onChange: (atBottom: boolean) => void }) => {
  // The hook returns ListScrollLocation whose flag is `isAtBottom`, not
  // `atBottom`. The autoscroll callback shape uses `atBottom` — different
  // API. Reading the wrong name left the button stuck visible forever.
  const { isAtBottom } = useVirtuosoLocation()
  useEffect(() => {
    onChange(Boolean(isAtBottom))
  }, [isAtBottom, onChange])
  return null
}
