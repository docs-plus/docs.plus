import { useFocusedHeadingStore, useStore } from '@stores'
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'
import { RefObject, useCallback, useEffect, useMemo, useRef } from 'react'

export { useFocusedHeadingStore }

/** Reading line: heading closest to this offset from the scroll container top wins */
const SPY_ANCHOR_PX = 60
/** Hysteresis band — keep current id while its top stays here (reduces flicker) */
const SPY_HYSTERESIS_TOP = -100
const SPY_HYSTERESIS_BOTTOM = 150
/** Still treat headings up to this far above the container as candidates */
const SPY_PAST_MAX = -300

const TOC_ALIGN_THROTTLE_MS = 160

/**
 * UniqueID also stamps `data-toc-id` on hyperlinks and tables. TOC rows only
 * exist for headings — observing all `[data-toc-id]` can set focus to an id
 * with no `.toc__item`, so the focus rail never appears.
 */
const HEADING_WITH_TOC_ID_SELECTOR = ':is(h1,h2,h3,h4,h5,h6)[data-toc-id]'

function isHeadingWithTocId(el: Element): boolean {
  return el.matches(HEADING_WITH_TOC_ID_SELECTOR)
}

function getVisibleHeadingEntries(
  container: HTMLElement,
  visibleMap: Map<string, Element>
): Array<{ id: string; el: Element }> {
  const fromMap = Array.from(visibleMap.entries())
    .filter(([, el]) => isHeadingWithTocId(el))
    .map(([id, el]) => ({ id, el }))

  if (fromMap.length > 0) {
    return fromMap
  }

  const cr = container.getBoundingClientRect()
  const out: Array<{ id: string; el: Element }> = []
  container.querySelectorAll(HEADING_WITH_TOC_ID_SELECTOR).forEach((el) => {
    const id = el.getAttribute('data-toc-id')
    if (!id) return
    const r = el.getBoundingClientRect()
    if (r.bottom <= cr.top || r.top >= cr.bottom) return
    out.push({ id, el })
  })
  return out
}

export function useHeadingScrollSpy(scrollContainerRef: RefObject<HTMLElement | null>) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const visibleHeadingsRef = useRef<Map<string, Element>>(new Map())
  const rafRef = useRef<number | null>(null)

  const editor = useStore((state) => state.settings.editor.instance)
  const setFocusedHeadingId = useFocusedHeadingStore((s) => s.setFocusedHeadingId)

  const updateFocus = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const entries = getVisibleHeadingEntries(container, visibleHeadingsRef.current)
    if (entries.length === 0) return

    const containerTop = container.getBoundingClientRect().top
    const currentId = useFocusedHeadingStore.getState().focusedHeadingId

    const headings = entries
      .map(({ id, el }) => ({
        id,
        offset: el.getBoundingClientRect().top - containerTop
      }))
      .sort((a, b) => a.offset - b.offset)

    const current = headings.find((h) => h.id === currentId)
    if (
      current &&
      current.offset >= SPY_HYSTERESIS_TOP &&
      current.offset <= SPY_HYSTERESIS_BOTTOM
    ) {
      return
    }

    let best: (typeof headings)[number] | undefined
    for (const h of headings) {
      if (h.offset <= SPY_ANCHOR_PX && h.offset >= SPY_PAST_MAX) best = h
    }
    if (!best) {
      best = headings.reduce((a, b) =>
        Math.abs(a.offset - SPY_ANCHOR_PX) < Math.abs(b.offset - SPY_ANCHOR_PX) ? a : b
      )
    }

    if (best && best.id !== currentId) {
      setFocusedHeadingId(best.id)
    }
  }, [scrollContainerRef, setFocusedHeadingId])

  const scheduleUpdateFocus = useCallback(() => {
    if (useFocusedHeadingStore.getState().isScrollLocked) return
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      updateFocus()
    })
  }, [updateFocus])

  const setupObserver = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    observerRef.current?.disconnect()
    visibleHeadingsRef.current.clear()

    const headings = container.querySelectorAll(HEADING_WITH_TOC_ID_SELECTOR)
    if (headings.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (useFocusedHeadingStore.getState().isScrollLocked) return

        for (const entry of entries) {
          const el = entry.target
          if (!isHeadingWithTocId(el)) continue

          const id = el.getAttribute('data-toc-id')
          if (!id) continue

          if (entry.isIntersecting) {
            visibleHeadingsRef.current.set(id, el)
          } else {
            visibleHeadingsRef.current.delete(id)
          }
        }
        scheduleUpdateFocus()
      },
      { root: container, rootMargin: '0px 0px -50% 0px', threshold: 0 }
    )

    headings.forEach((h) => observerRef.current?.observe(h))

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scheduleUpdateFocus())
    })
  }, [scrollContainerRef, scheduleUpdateFocus])

  const debouncedSetup = useMemo(() => debounce(setupObserver, 100), [setupObserver])

  useEffect(() => {
    if (!editor) return
    debouncedSetup()
    editor.on('update', debouncedSetup)
    return () => {
      editor.off('update', debouncedSetup)
      debouncedSetup.cancel()
      observerRef.current?.disconnect()
      observerRef.current = null
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [editor, debouncedSetup])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const onScroll = () => {
      if (!useFocusedHeadingStore.getState().isScrollLocked) scheduleUpdateFocus()
    }
    container.addEventListener('scroll', onScroll, { passive: true })

    let resizeRafId: number | null = null
    const ro = new ResizeObserver(() => {
      if (resizeRafId !== null) return
      resizeRafId = window.requestAnimationFrame(() => {
        resizeRafId = null
        scheduleUpdateFocus()
      })
    })
    ro.observe(container)

    return () => {
      container.removeEventListener('scroll', onScroll)
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (resizeRafId !== null) {
        window.cancelAnimationFrame(resizeRafId)
        resizeRafId = null
      }
      ro.disconnect()
    }
  }, [scrollContainerRef, scheduleUpdateFocus])
}

function tocItemSelector(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return `.toc__item[data-id="${CSS.escape(id)}"]`
  }
  return `.toc__item[data-id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`
}

/** Scroll the row link, not the whole `li` — parent items wrap a tall nested `ul`, so
 * `li.scrollIntoView` often keeps the top row (and focus rail) above the viewport. */
function tocRowScrollTarget(id: string): Element | null {
  const li = document.querySelector(tocItemSelector(id))
  if (!li) return null
  return li.querySelector(':scope > a') ?? li
}

export function useTocAutoScroll() {
  const focusedHeadingId = useFocusedHeadingStore((s) => s.focusedHeadingId)

  const alignTocItem = useMemo(
    () =>
      throttle(
        (id: string) => {
          const target = tocRowScrollTarget(id)
          if (!target) return

          target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        },
        TOC_ALIGN_THROTTLE_MS,
        { leading: true, trailing: true }
      ),
    []
  )

  useEffect(() => {
    if (focusedHeadingId) alignTocItem(focusedHeadingId)
    return () => alignTocItem.cancel()
  }, [focusedHeadingId, alignTocItem])
}
