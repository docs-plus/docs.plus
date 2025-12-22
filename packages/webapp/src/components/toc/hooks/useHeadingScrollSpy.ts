import { useEffect, useRef, useCallback, useMemo, RefObject } from 'react'
import { useStore, useFocusedHeadingStore } from '@stores'
import debounce from 'lodash/debounce'

export { useFocusedHeadingStore }

export function useHeadingScrollSpy(scrollContainerRef: RefObject<HTMLElement | null>) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const visibleHeadingsRef = useRef<Map<string, Element>>(new Map())

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)
  const setFocusedHeadingId = useFocusedHeadingStore((s) => s.setFocusedHeadingId)

  const updateFocus = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || visibleHeadingsRef.current.size === 0) return

    const containerTop = container.getBoundingClientRect().top
    const currentId = useFocusedHeadingStore.getState().focusedHeadingId

    // Get positions of all visible headings
    const headings = Array.from(visibleHeadingsRef.current.entries())
      .map(([id, el]) => ({
        id,
        offset: el.getBoundingClientRect().top - containerTop
      }))
      .sort((a, b) => a.offset - b.offset)

    // Current heading still in good position? Keep it (hysteresis)
    const current = headings.find((h) => h.id === currentId)
    if (current && current.offset >= -100 && current.offset <= 150) return

    // Find best: last heading above 60px, or closest overall
    let best = headings.find((h) => h.offset <= 60 && h.offset >= -300)
    for (const h of headings) {
      if (h.offset <= 60 && h.offset >= -300) best = h
    }
    if (!best)
      best = headings.reduce((a, b) => (Math.abs(a.offset - 60) < Math.abs(b.offset - 60) ? a : b))

    if (best && best.id !== currentId) {
      setFocusedHeadingId(best.id)
    }
  }, [scrollContainerRef, setFocusedHeadingId])

  const debouncedUpdate = useMemo(
    () => debounce(updateFocus, 16, { leading: true, trailing: true, maxWait: 50 }),
    [updateFocus]
  )

  const setupObserver = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    observerRef.current?.disconnect()
    visibleHeadingsRef.current.clear()

    const headings = container.querySelectorAll('.heading[data-id]')
    if (headings.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (useFocusedHeadingStore.getState().isScrollLocked) return

        for (const entry of entries) {
          const id = entry.target.getAttribute('data-id')
          if (!id) continue

          if (entry.isIntersecting) {
            visibleHeadingsRef.current.set(id, entry.target)
          } else {
            visibleHeadingsRef.current.delete(id)
          }
        }
        debouncedUpdate()
      },
      { root: container, rootMargin: '0px 0px -50% 0px', threshold: 0 }
    )

    headings.forEach((h) => {
      if (h.getAttribute('data-id')) observerRef.current?.observe(h)
    })
  }, [scrollContainerRef, debouncedUpdate])

  const debouncedSetup = useMemo(() => debounce(setupObserver, 100), [setupObserver])

  useEffect(() => {
    if (!editor) return
    debouncedSetup()
    editor.on('update', debouncedSetup)
    return () => {
      editor.off('update', debouncedSetup)
      debouncedSetup.cancel()
      observerRef.current?.disconnect()
    }
  }, [editor, debouncedSetup])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const onScroll = () => {
      if (!useFocusedHeadingStore.getState().isScrollLocked) debouncedUpdate()
    }
    container.addEventListener('scroll', onScroll, { passive: true })

    const ro = new ResizeObserver(() => debouncedSetup())
    ro.observe(container)

    return () => {
      container.removeEventListener('scroll', onScroll)
      debouncedUpdate.cancel()
      ro.disconnect()
    }
  }, [scrollContainerRef, debouncedUpdate, debouncedSetup])
}

export function useTocAutoScroll() {
  const focusedHeadingId = useFocusedHeadingStore((s) => s.focusedHeadingId)

  const scrollToItem = useMemo(
    () =>
      debounce((id: string) => {
        const item = document.querySelector(`.toc__item[data-id="${id}"]`)
        const container = document.querySelector('.toc__list')?.parentElement
        if (!item || !container) return

        const containerRect = container.getBoundingClientRect()
        const itemRect = item.getBoundingClientRect()

        if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
          container.scrollTo({
            top: itemRect.top - containerRect.top + container.scrollTop - 10,
            behavior: 'smooth'
          })
        }
      }, 50),
    []
  )

  useEffect(() => {
    if (focusedHeadingId) scrollToItem(focusedHeadingId)
    return () => scrollToItem.cancel()
  }, [focusedHeadingId, scrollToItem])
}
