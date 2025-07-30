import { useCallback, useRef } from 'react'

const DOUBLE_TAP_DELAY = 300 // ms

const useDoubleTap = (onDoubleTap: () => void) => {
  const lastTapTime = useRef<number>(0)

  const handleTap = useCallback(() => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapTime.current

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
      onDoubleTap()
    }

    lastTapTime.current = now
  }, [onDoubleTap])

  return handleTap
}

export default useDoubleTap
