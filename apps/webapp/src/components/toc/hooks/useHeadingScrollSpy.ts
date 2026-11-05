import { useFocusedHeadingStore, useStore } from '@stores'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'
import { clampToContainerFraction } from '@utils/clampToContainerFraction'
import { scrollNearestInScroller } from '@utils/scrollNearestInScroller'
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'
import { RefObject, useCallback, useEffect, useMemo, useRef } from 'react'

import { TOC_CLASSES } from '../tocClasses'
import { transactionRequiresTocRebuild } from '../utils/headingTransaction'

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

/** Top-level `id:level` list, the same headings the TOC rows come from. */
function headingSignature(doc: PMNode): { signature: string; count: number } {
  let signature = ''
  let count = 0
  doc.forEach((node) => {
    if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) return
    const id = node.attrs['toc-id'] as string | null
    if (!id) return
    signature += `${id}:${node.attrs.level}|`
    count++
  })
  return { signature, count }
}

interface ObservedHeadings {
  /** Null when the DOM held fewer headings than the doc, so the next check rebuilds. */
  signature: string | null
  byId: Map<string, Element>
}

function scanVisibleHeadings(container: HTMLElement): Array<{ id: string; el: Element }> {
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
  const observedRef = useRef<ObservedHeadings | null>(null)
  const rafRef = useRef<number | null>(null)
  const setupRafIdsRef = useRef<number[]>([])

  const editor = useStore((state) => state.settings.editor.instance)
  const setFocusedHeadingId = useFocusedHeadingStore((s) => s.setFocusedHeadingId)

  const updateFocus = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let entries = Array.from(visibleHeadingsRef.current.entries())
      .filter(([, el]) => isHeadingWithTocId(el))
      .map(([id, el]) => ({ id, el }))
    if (entries.length === 0) {
      // Inside a long section no heading is in the top half. Keep the focus; the IO reports
      // the next heading that crosses in. Scan only on first paint or when the focus is gone.
      const focusedId = useFocusedHeadingStore.getState().focusedHeadingId
      if (focusedId && observedRef.current?.byId.get(focusedId)?.isConnected) return
      entries = scanVisibleHeadings(container)
    }
    if (entries.length === 0) return

    const containerRect = container.getBoundingClientRect()
    const containerTop = containerRect.top
    const anchor = clampToContainerFraction(SPY_ANCHOR_PX, containerRect.height)
    const hysteresisTop = clampToContainerFraction(SPY_HYSTERESIS_TOP, containerRect.height)
    const hysteresisBottom = clampToContainerFraction(SPY_HYSTERESIS_BOTTOM, containerRect.height)
    const pastMax = clampToContainerFraction(SPY_PAST_MAX, containerRect.height)
    const currentId = useFocusedHeadingStore.getState().focusedHeadingId

    const headings = entries
      .map(({ id, el }) => ({
        id,
        offset: el.getBoundingClientRect().top - containerTop
      }))
      .sort((a, b) => a.offset - b.offset)

    const current = headings.find((h) => h.id === currentId)
    if (current && current.offset >= hysteresisTop && current.offset <= hysteresisBottom) {
      return
    }

    let best: (typeof headings)[number] | undefined
    for (const h of headings) {
      if (h.offset <= anchor && h.offset >= pastMax) best = h
    }
    if (!best) {
      best = headings.reduce((a, b) =>
        Math.abs(a.offset - anchor) < Math.abs(b.offset - anchor) ? a : b
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
      // A TOC click can set the lock after this frame was queued.
      if (!useFocusedHeadingStore.getState().isScrollLocked) updateFocus()
    })
  }, [updateFocus])

  const setupObserver = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || !editor || editor.isDestroyed) return

    observerRef.current?.disconnect()
    observerRef.current = null
    visibleHeadingsRef.current.clear()

    const headings = container.querySelectorAll(HEADING_WITH_TOC_ID_SELECTOR)
    const byId = new Map<string, Element>()
    headings.forEach((el) => {
      const id = el.getAttribute('data-toc-id')
      if (id) byId.set(id, el)
    })
    const { signature, count } = headingSignature(editor.state.doc)
    observedRef.current = { signature: byId.size < count ? null : signature, byId }
    if (headings.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // No lock check here: IO reports only changes, so a skipped entry leaves the map stale.
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

    for (const id of setupRafIdsRef.current) window.cancelAnimationFrame(id)
    setupRafIdsRef.current = []
    const outer = window.requestAnimationFrame(() => {
      const inner = window.requestAnimationFrame(() => scheduleUpdateFocus())
      setupRafIdsRef.current.push(inner)
    })
    setupRafIdsRef.current.push(outer)
  }, [scrollContainerRef, scheduleUpdateFocus, editor])

  // Typing in a heading keeps its element, so the observations stay valid. Rebuild only when
  // the id:level list changes, or when ProseMirror replaced an observed element (a non-level
  // attr change, a remote y-sync replace, a restore).
  const rebuildIfHeadingsChanged = useCallback(() => {
    const observed = observedRef.current
    if (observed && editor && !editor.isDestroyed) {
      const unchanged =
        observed.signature === headingSignature(editor.state.doc).signature &&
        Array.from(observed.byId.values()).every((el) => el.isConnected)
      if (unchanged) return
    }
    setupObserver()
  }, [editor, setupObserver])

  const debouncedRebuild = useMemo(
    () => debounce(rebuildIfHeadingsChanged, 100),
    [rebuildIfHeadingsChanged]
  )

  useEffect(() => {
    if (!editor) return
    observedRef.current = null
    debouncedRebuild()

    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      // Cheap filter: only steps inside or across headings reach the id:level check.
      if (!transactionRequiresTocRebuild(transaction)) return
      debouncedRebuild()
    }
    editor.on('transaction', onTransaction)

    return () => {
      editor.off('transaction', onTransaction)
      debouncedRebuild.cancel()
      observerRef.current?.disconnect()
      observerRef.current = null
      observedRef.current = null
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      for (const id of setupRafIdsRef.current) window.cancelAnimationFrame(id)
      setupRafIdsRef.current = []
    }
  }, [editor, debouncedRebuild])

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

/** Scroll the row, not the whole `li`. Parent items wrap a tall nested `ul`, so
 * `li.scrollIntoView` often keeps the top row (and focus rail) above the viewport.
 * The lookup starts at the TOC root, so it does not walk the editor DOM. */
function tocRowScrollTarget(id: string): Element | null {
  const li = document.querySelector('.tiptap__toc')?.querySelector(tocItemSelector(id))
  if (!li) return null
  return li.querySelector(`:scope > .${TOC_CLASSES.row}`) ?? li
}

/** Align TOC scroller to spy focus without re-rendering the outline tree. */
export function useTocAutoScroll() {
  const alignTocItem = useMemo(
    () =>
      throttle(
        (id: string) => {
          const target = tocRowScrollTarget(id)
          if (target) scrollNearestInScroller(target)
        },
        TOC_ALIGN_THROTTLE_MS,
        { leading: true, trailing: true }
      ),
    []
  )

  useEffect(() => {
    let prevId = useFocusedHeadingStore.getState().focusedHeadingId
    if (prevId) alignTocItem(prevId)

    const unsub = useFocusedHeadingStore.subscribe((state) => {
      const nextId = state.focusedHeadingId
      if (nextId === prevId) return
      prevId = nextId
      if (nextId) alignTocItem(nextId)
    })

    return () => {
      unsub()
      alignTocItem.cancel()
    }
  }, [alignTocItem])
}
