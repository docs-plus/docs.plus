import { useEffect, useRef, useCallback, useMemo, RefObject } from 'react'
import { useStore } from '@stores'
import { create } from 'zustand'
import debounce from 'lodash/debounce'

/**
 * Zustand store for focused heading state
 * Shared between scroll spy and TOC components
 */
interface FocusedHeadingStore {
  focusedHeadingId: string | null
  setFocusedHeadingId: (id: string | null) => void
}

export const useFocusedHeadingStore = create<FocusedHeadingStore>((set) => ({
  focusedHeadingId: null,
  setFocusedHeadingId: (id) => set({ focusedHeadingId: id })
}))

// Stable selector to prevent re-renders
const selectSetFocusedHeadingId = (s: FocusedHeadingStore) => s.setFocusedHeadingId

/**
 * Hook that uses IntersectionObserver to track which heading is currently
 * visible in the viewport. Updates the focused heading store which the TOC
 * subscribes to for highlighting.
 *
 * Why IntersectionObserver instead of scroll + offset calculations:
 * - Automatically handles layout changes, resize, fold/unfold
 * - More performant than scroll listeners with getBoundingClientRect
 * - No magic offset numbers that break on different viewport sizes
 * - Works correctly when editor size changes
 */
export function useHeadingScrollSpy(scrollContainerRef: RefObject<HTMLElement | null>) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const headingMapRef = useRef<Map<Element, string>>(new Map())
  const visibleHeadingsRef = useRef<Map<string, { element: Element; ratio: number }>>(new Map())
  const rafIdRef = useRef<number | null>(null)

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // Use stable selector to prevent unnecessary re-renders
  const setFocusedHeadingId = useFocusedHeadingStore(selectSetFocusedHeadingId)

  /**
   * Find the topmost visible heading and update store
   */
  const updateFocusedHeading = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || visibleHeadingsRef.current.size === 0) {
      return
    }

    // Get all visible headings sorted by their position in the document
    const visibleEntries = Array.from(visibleHeadingsRef.current.entries())

    if (visibleEntries.length === 0) return

    // Find the heading closest to the top of the viewport
    // Use getBoundingClientRect for accurate position (handles all layout cases)
    const containerRect = container.getBoundingClientRect()
    const topOffset = containerRect.top

    let closestHeading: { id: string; distance: number } | null = null

    for (const [headingId, { element }] of visibleEntries) {
      const rect = element.getBoundingClientRect()
      // Distance from top of container to top of heading
      const distance = rect.top - topOffset

      // We want the heading that's at or just above the top of the viewport
      // Negative distance means heading has scrolled past the top
      if (closestHeading === null || (distance <= 50 && distance > closestHeading.distance)) {
        closestHeading = { id: headingId, distance }
      } else if (distance > 0 && distance < 100 && closestHeading.distance < -100) {
        // If no heading is close to top, use the first visible one
        closestHeading = { id: headingId, distance }
      }
    }

    // Fallback: if no heading found with above logic, use first visible
    if (!closestHeading && visibleEntries.length > 0) {
      // Sort by DOM position and pick the first one
      const sorted = visibleEntries.sort((a, b) => {
        const rectA = a[1].element.getBoundingClientRect()
        const rectB = b[1].element.getBoundingClientRect()
        return rectA.top - rectB.top
      })
      closestHeading = { id: sorted[0][0], distance: 0 }
    }

    if (closestHeading) {
      setFocusedHeadingId(closestHeading.id)
    }
  }, [scrollContainerRef, setFocusedHeadingId])

  /**
   * IntersectionObserver callback
   * Tracks which headings are visible and their intersection ratios
   */
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        const headingId = headingMapRef.current.get(entry.target)
        if (!headingId) continue

        if (entry.isIntersecting) {
          visibleHeadingsRef.current.set(headingId, {
            element: entry.target,
            ratio: entry.intersectionRatio
          })
        } else {
          visibleHeadingsRef.current.delete(headingId)
        }
      }

      updateFocusedHeading()
    },
    [updateFocusedHeading]
  )

  /**
   * Setup observer and observe all heading elements
   */
  const setupObserver = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Clear maps
    headingMapRef.current.clear()
    visibleHeadingsRef.current.clear()

    // Find all heading elements within the editor
    const headings = container.querySelectorAll('.heading[data-id]')
    if (headings.length === 0) return

    // Create observer with container as root
    // rootMargin: slightly expand the top detection zone to catch headings
    // that are just about to scroll into view
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: container,
      rootMargin: '0px 0px -70% 0px', // Top 30% of viewport triggers
      threshold: [0, 0.1, 0.5, 1.0]
    })

    // Observe each heading
    headings.forEach((heading) => {
      const headingId = heading.getAttribute('data-id')
      if (headingId) {
        headingMapRef.current.set(heading, headingId)
        observerRef.current?.observe(heading)
      }
    })
  }, [scrollContainerRef, handleIntersection])

  /**
   * Debounced setup - prevents rapid updates from stacking
   * Using lodash debounce with trailing edge (default)
   */
  const debouncedSetupObserver = useMemo(
    () => debounce(setupObserver, 100, { leading: false, trailing: true }),
    [setupObserver]
  )

  /**
   * Re-observe when editor content changes
   */
  useEffect(() => {
    if (!editor) return

    // Initial setup with delay for DOM to be ready
    debouncedSetupObserver()

    // Re-observe on editor transactions that affect headings
    const handleUpdate = () => {
      debouncedSetupObserver()
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
      // Cancel pending debounced calls and cleanup observers
      debouncedSetupObserver.cancel()
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [editor, debouncedSetupObserver])

  /**
   * Also re-observe on scroll (handles edge cases after fold/unfold)
   */
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Throttled scroll handler to update focused heading
    const handleScroll = () => {
      if (rafIdRef.current) return
      rafIdRef.current = requestAnimationFrame(() => {
        updateFocusedHeading()
        rafIdRef.current = null
      })
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [scrollContainerRef, updateFocusedHeading])

  /**
   * Handle resize events (editor size changes)
   */
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      debouncedSetupObserver()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [scrollContainerRef, debouncedSetupObserver])
}

// Stable selector for focused heading ID
const selectFocusedHeadingId = (s: FocusedHeadingStore) => s.focusedHeadingId

/**
 * Scrolls the TOC container to show the specified heading item
 */
function scrollTocToHeading(headingId: string) {
  const tocItem = document.querySelector(`.toc__item[data-id="${headingId}"]`)
  if (!tocItem) return

  const tocContainer = document.querySelector('.toc__list')?.parentElement
  if (!tocContainer) return

  const tocRect = tocContainer.getBoundingClientRect()
  const itemRect = tocItem.getBoundingClientRect()

  const isAbove = itemRect.top < tocRect.top
  const isBelow = itemRect.bottom > tocRect.bottom

  if (isAbove || isBelow) {
    const relativeTop = itemRect.top - tocRect.top + tocContainer.scrollTop
    tocContainer.scrollTo({
      top: Math.max(0, relativeTop - 10),
      behavior: 'smooth'
    })
  }
}

/**
 * Hook to scroll the TOC to show the focused heading
 * Debounced to prevent excessive scrolling during rapid updates
 */
export function useTocAutoScroll() {
  const focusedHeadingId = useFocusedHeadingStore(selectFocusedHeadingId)

  // Memoize debounced scroll function - stable across renders
  const debouncedScrollToHeading = useMemo(
    () => debounce(scrollTocToHeading, 50, { leading: false, trailing: true }),
    []
  )

  useEffect(() => {
    if (!focusedHeadingId) return

    debouncedScrollToHeading(focusedHeadingId)

    return () => {
      debouncedScrollToHeading.cancel()
    }
  }, [focusedHeadingId, debouncedScrollToHeading])
}
