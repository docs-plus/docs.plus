import { MOTION_OVERLAY_OUT_MS, prefersReducedMotion } from '@utils/motion'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useFeedItemExit<TId extends string | number>() {
  const [exitingIds, setExitingIds] = useState<Set<TId>>(() => new Set())
  const timersRef = useRef<Map<TId, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const isExiting = useCallback((id: TId) => exitingIds.has(id), [exitingIds])

  const runWithExit = useCallback(
    (id: TId, onComplete: () => void, onStart?: () => void) => {
      if (exitingIds.has(id)) return false

      setExitingIds((prev) => new Set(prev).add(id))
      onStart?.()

      const finish = () => {
        onComplete()
        setExitingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        timersRef.current.delete(id)
      }

      const exitMs = prefersReducedMotion() ? 0 : MOTION_OVERLAY_OUT_MS
      if (exitMs === 0) {
        finish()
      } else {
        timersRef.current.set(id, setTimeout(finish, exitMs))
      }

      return true
    },
    [exitingIds]
  )

  return { isExiting, runWithExit }
}
