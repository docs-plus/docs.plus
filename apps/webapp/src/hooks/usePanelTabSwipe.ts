import type { PanelTabOption } from '@components/ui/PanelTabBar'
import { MOTION_PANEL_MS, prefersReducedMotion } from '@utils/motion'
import {
  type CSSProperties,
  type TouchEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

const SWIPE_LOCK_PX = 10
const HORIZONTAL_BIAS = 1.25
const SWIPE_COMMIT_RATIO = 0.22
const SWIPE_MIN_PX = 48
const RUBBER_BAND = 0.35
const TRANSITION_FALLBACK_MS = MOTION_PANEL_MS + 50

type UsePanelTabSwipeOptions<TTab extends string> = {
  enabled: boolean
  tabs: readonly PanelTabOption<TTab>[]
  activeTab: TTab
  onSelect: (tab: TTab) => void
}

type TouchPoint = { x: number; y: number }

export function usePanelTabSwipe<TTab extends string>({
  enabled,
  tabs,
  activeTab,
  onSelect
}: UsePanelTabSwipeOptions<TTab>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<TouchPoint | null>(null)
  const lockedRef = useRef(false)
  const animatingRef = useRef(false)
  const dragXRef = useRef(0)
  const transitionCleanupRef = useRef<(() => void) | null>(null)

  const [translateX, setTranslateX] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [scrollLocked, setScrollLocked] = useState(false)
  /** Tab-bar tap fade only — swipe uses slide transform; never toggles React key. */
  const [fadeEnter, setFadeEnter] = useState(true)

  const tabIndex = tabs.findIndex((tab) => tab.label === activeTab)

  const cancelTransition = useCallback(() => {
    transitionCleanupRef.current?.()
    transitionCleanupRef.current = null
  }, [])

  useEffect(() => {
    if (animatingRef.current) return
    cancelTransition()
    dragXRef.current = 0
    setTranslateX(0)
    setIsAnimating(false)
    setScrollLocked(false)
    lockedRef.current = false
    setFadeEnter(true)
  }, [activeTab, cancelTransition])

  useEffect(() => cancelTransition, [cancelTransition])

  const restoreIdle = useCallback(() => {
    animatingRef.current = false
    setIsAnimating(false)
    setFadeEnter(true)
  }, [])

  const runTransition = useCallback(
    (target: number, onComplete?: () => void) => {
      cancelTransition()

      if (prefersReducedMotion()) {
        dragXRef.current = 0
        setTranslateX(0)
        setIsAnimating(false)
        animatingRef.current = false
        onComplete?.()
        return
      }

      animatingRef.current = true
      setIsAnimating(true)
      dragXRef.current = target
      setTranslateX(target)

      const node = containerRef.current
      const finish = () => {
        cancelTransition()
        onComplete?.()
      }

      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== node || event.propertyName !== 'transform') return
        finish()
      }

      const fallback = window.setTimeout(finish, TRANSITION_FALLBACK_MS)
      node?.addEventListener('transitionend', onTransitionEnd)
      transitionCleanupRef.current = () => {
        clearTimeout(fallback)
        node?.removeEventListener('transitionend', onTransitionEnd)
      }
    },
    [cancelTransition]
  )

  const finishGesture = useCallback(() => {
    touchStartRef.current = null
    lockedRef.current = false
    setScrollLocked(false)
  }, [])

  const onTouchStart: TouchEventHandler = useCallback(
    (event) => {
      if (!enabled || animatingRef.current || event.touches.length !== 1) return
      const touch = event.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
      lockedRef.current = false
    },
    [enabled]
  )

  const onTouchMove: TouchEventHandler = useCallback(
    (event) => {
      if (!enabled || animatingRef.current) return

      const start = touchStartRef.current
      if (!start || event.touches.length !== 1) return

      const touch = event.touches[0]
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y

      if (!lockedRef.current) {
        if (Math.abs(dx) < SWIPE_LOCK_PX) return
        if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return
        lockedRef.current = true
        setScrollLocked(true)
        setFadeEnter(false)
      }

      let banded = dx
      if (tabIndex >= 0) {
        if (tabIndex <= 0 && dx > 0) banded = dx * RUBBER_BAND
        else if (tabIndex >= tabs.length - 1 && dx < 0) banded = dx * RUBBER_BAND
      }

      dragXRef.current = banded
      setTranslateX(banded)
    },
    [enabled, tabIndex, tabs.length]
  )

  const onTouchEnd: TouchEventHandler = useCallback(
    (event) => {
      if (!enabled || animatingRef.current) return

      const start = touchStartRef.current
      if (!start) return

      const wasLocked = lockedRef.current
      const touch = event.changedTouches[0]
      if (!touch) {
        finishGesture()
        return
      }

      const dx = wasLocked ? dragXRef.current : touch.clientX - start.x
      finishGesture()

      if (!wasLocked) return

      const width = containerRef.current?.clientWidth ?? 0
      if (width <= 0 || tabIndex < 0) {
        dragXRef.current = 0
        setTranslateX(0)
        setFadeEnter(true)
        return
      }

      const commitThreshold = Math.max(SWIPE_MIN_PX, width * SWIPE_COMMIT_RATIO)
      const goingNext = dx < 0
      const nextIndex = goingNext ? tabIndex + 1 : tabIndex - 1
      const canCommit = Math.abs(dx) >= commitThreshold && nextIndex >= 0 && nextIndex < tabs.length

      if (!canCommit) {
        runTransition(0, restoreIdle)
        return
      }

      const exitX = goingNext ? -width : width
      const enterX = goingNext ? width : -width

      runTransition(exitX, () => {
        onSelect(tabs[nextIndex].label)
        dragXRef.current = enterX
        setTranslateX(enterX)

        window.requestAnimationFrame(() => {
          runTransition(0, restoreIdle)
        })
      })
    },
    [enabled, finishGesture, onSelect, restoreIdle, runTransition, tabIndex, tabs]
  )

  const onTouchCancel: TouchEventHandler = useCallback(() => {
    finishGesture()
    if (animatingRef.current) return
    cancelTransition()
    dragXRef.current = 0
    setTranslateX(0)
    setFadeEnter(true)
  }, [cancelTransition, finishGesture])

  const slideStyle: CSSProperties | undefined =
    enabled && (translateX !== 0 || isAnimating)
      ? {
          transform: `translateX(${translateX}px)`,
          transition: isAnimating ? `transform ${MOTION_PANEL_MS}ms ease-out` : 'none',
          willChange: 'transform'
        }
      : undefined

  return {
    containerRef,
    slideStyle: enabled ? slideStyle : undefined,
    scrollLocked: enabled ? scrollLocked : false,
    fadeEnter: enabled ? fadeEnter : true,
    isAnimating: enabled ? isAnimating : false,
    handlers: enabled ? { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } : {}
  }
}
