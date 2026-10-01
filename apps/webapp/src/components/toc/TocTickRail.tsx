import { popoverPanelClassName } from '@components/ui/Popover'
import { Tooltip } from '@components/ui/Tooltip'
import { useOverlayTransition } from '@components/ui/useOverlayTransition'
import {
  autoUpdate,
  flip,
  FloatingPortal,
  limitShift,
  offset,
  shift,
  useFloating
} from '@floating-ui/react'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore, useStore } from '@stores'
import type { TocItem } from '@types'
import { MOTION_OVERLAY_IN_MS, prefersReducedMotion } from '@utils/motion'
import { twMerge } from '@utils/twMerge'
import {
  type KeyboardEvent,
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { tocActions, useToc } from './hooks'

const PREVIEW_MAX_BLOCKS = 5
const PREVIEW_OPEN_MS = 80
const TICK_OVERSCAN = 16
const RAIL_USER_SCROLL_LOCK_MS = 800
const RAIL_SPY_CONTEXT_TICKS = 8
const RAIL_MAX_VIEWPORT_RATIO = 0.84
const TICK_HOVER_SLOP_PX = 72
const TICK_APPROACH_GROW = 0.78
// Must match the tick button's h-2 (8px).
const TICK_ROW_PX = 8
const TICK_WIDTH = {
  idle: 10,
  far: 13,
  mid: 15,
  near: 18,
  hover: 24,
  focused: 22,
  chat: 22
} as const

type TickKind = 'idle' | 'near' | 'mid' | 'far' | 'hover' | 'focused' | 'chat'

type TickHoverState = {
  id: string | null
  grow: number
  inRail: boolean
}

const HOVER_IDLE: TickHoverState = { id: null, grow: 0, inRail: false }

const PREVIEW_STRIP_SEL = [
  '.ha-wrap',
  '.ha-group',
  '.ha-selection-comment-dock',
  '.collaboration-cursor__caret',
  '.collaboration-cursor__label',
  '.collaboration-cursor__avatar',
  '.ProseMirror-widget',
  '.heading-fold-crinkle',
  '.media-toolbar',
  '.hypermultimedia__resize-gripper',
  '.ProseMirror-separator',
  '.ProseMirror-trailingBreak',
  '.hm-caption',
  '.hm-loading-shell',
  '.hm-loading-shell__overlay'
].join(',')

const PREVIEW_MEDIA_SEL = 'img, video, audio, iframe'

type RailGeometry = {
  top: number
  left: number
  right: number
  bottom: number
  firstTop: number
}

function visibleRailItems(items: TocItem[]): TocItem[] {
  const out: TocItem[] = []
  let hideDeeperThan: number | null = null
  for (const item of items) {
    if (hideDeeperThan != null && item.level > hideDeeperThan) continue
    out.push(item)
    hideDeeperThan = item.open ? null : item.level
  }
  return out
}

function maxRailTicks(navH: number, viewH: number) {
  const vh = viewH > 0 ? viewH : window.innerHeight
  if (vh <= 0 && navH <= 0) return Number.POSITIVE_INFINITY
  const viewCap = vh > 0 ? vh * RAIL_MAX_VIEWPORT_RATIO : navH
  const measured = navH > 0 ? Math.min(navH, viewCap) : viewCap
  return Math.max(1, Math.floor(measured / TICK_ROW_PX))
}

function deepestKeptLevel(items: TocItem[], maxTicks: number) {
  let deepest = 1
  for (const item of items) {
    if (item.level > deepest) deepest = item.level
  }
  if (!Number.isFinite(maxTicks) || items.length <= maxTicks) return deepest

  let kept = items.length
  while (kept > maxTicks && deepest > 1) {
    deepest -= 1
    kept = 0
    for (const item of items) {
      if (item.level <= deepest) kept += 1
    }
  }
  return deepest
}

function sectionRootIndex(items: TocItem[], spyId: string | null, cap: number) {
  const spyAt = spyId ? items.findIndex((item) => item.id === spyId) : -1
  const from = spyAt >= 0 ? spyAt : 0
  for (let i = from; i >= 0; i--) {
    if (items[i].level <= cap) return i
  }
  return 0
}

function fillDeeperAroundSpy(
  items: TocItem[],
  cap: number,
  extra: number,
  spyId: string | null
): TocItem[] {
  if (extra <= 0) return []
  const root = sectionRootIndex(items, spyId, cap)
  const picked: TocItem[] = []
  const take = (start: number, end: number) => {
    for (let i = start; i < end && picked.length < extra; i++) {
      if (items[i].level > cap) picked.push(items[i])
    }
  }
  take(root + 1, items.length)
  take(0, root)
  return picked
}

function fitRailItems(items: TocItem[], maxTicks: number, spyId: string | null): TocItem[] {
  if (!Number.isFinite(maxTicks) || items.length <= maxTicks) return items
  const cap = deepestKeptLevel(items, maxTicks)
  const keep = new Set<string>()
  for (const item of items) {
    if (item.level <= cap) keep.add(item.id)
  }
  const extra = maxTicks - keep.size
  for (const item of fillDeeperAroundSpy(items, cap, extra, spyId)) {
    keep.add(item.id)
  }
  return items.filter((item) => keep.has(item.id))
}

function visibleSpyId(items: TocItem[], visible: TocItem[], id: string | null): string | null {
  if (!id) return null
  if (visible.some((item) => item.id === id)) return id
  const idx = items.findIndex((item) => item.id === id)
  if (idx < 0) return null
  let need = items[idx].level
  for (let i = idx - 1; i >= 0; i--) {
    const ancestor = items[i]
    if (ancestor.level >= need) continue
    need = ancestor.level
    if (visible.some((item) => item.id === ancestor.id)) return ancestor.id
  }
  return null
}

function railWindow(scrollTop: number, height: number, count: number) {
  if (count === 0) return { start: 0, end: 0 }
  const row = TICK_ROW_PX
  const overscan = TICK_OVERSCAN
  const start = Math.max(0, Math.floor(scrollTop / row) - overscan)
  const end = Math.min(count, Math.ceil((scrollTop + (height || 640)) / row) + overscan)
  return { start, end }
}

function railStackOffset(railH: number, stackH: number): number {
  if (stackH <= 0 || railH <= 0) return 0
  const room = railH - stackH
  if (room <= 0) return 0
  return Math.floor(room / 2)
}

function clampScroll(next: number, max: number) {
  return Math.max(0, Math.min(max, next))
}

function railSpyScrollTop(index: number, count: number, innerH: number, current: number) {
  const row = TICK_ROW_PX
  const total = count * row
  const maxScroll = Math.max(0, total - innerH)
  if (maxScroll === 0) return 0

  const rowTop = index * row
  const rowBottom = rowTop + row
  const rowMid = rowTop + row / 2
  const viewTop = current
  const viewBottom = current + innerH
  const pad = Math.min(RAIL_SPY_CONTEXT_TICKS * row, Math.floor(innerH / 4))

  if (rowBottom < viewTop || rowTop > viewBottom) {
    return clampScroll(rowMid - innerH / 2, maxScroll)
  }
  if (rowTop >= viewTop + pad && rowBottom <= viewBottom - pad) return current
  if (rowTop < viewTop + pad) return clampScroll(rowTop - pad, maxScroll)
  return clampScroll(rowBottom + pad - innerH, maxScroll)
}

function alignRailToSpy(nav: HTMLElement, index: number, count: number) {
  const style = getComputedStyle(nav)
  const padTop = parseFloat(style.paddingTop) || 0
  const padBottom = parseFloat(style.paddingBottom) || 0
  const innerH = nav.clientHeight - padTop - padBottom
  const next = railSpyScrollTop(index, count, innerH, nav.scrollTop)
  if (Math.abs(next - nav.scrollTop) < 1) return
  nav.scrollTop = next
}

function readRailGeometry(nav: HTMLElement): RailGeometry {
  const rail = nav.getBoundingClientRect()
  const stack = nav.querySelector<HTMLElement>('[data-toc-rail-stack]')
  return {
    top: rail.top,
    left: rail.left,
    right: rail.right,
    bottom: rail.bottom,
    firstTop: stack?.getBoundingClientRect().top ?? rail.top
  }
}

function tickDashClass(kind: TickKind): string {
  switch (kind) {
    case 'chat':
    case 'focused':
      return 'bg-primary h-0.5'
    case 'hover':
      return 'bg-base-content h-0.5'
    case 'near':
      return 'bg-base-content/75 h-0.5'
    case 'mid':
      return 'bg-base-content/60 h-0.5'
    case 'far':
      return 'bg-base-content/50 h-0.5'
    case 'idle':
      return 'bg-base-content/40 h-0.5'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

function headingLevel(el: Element): number | null {
  const tag = el.tagName
  if (tag.length === 2 && tag[0] === 'H' && tag[1] >= '1' && tag[1] <= '6') {
    return Number(tag[1])
  }
  return null
}

function collectSectionElements(headingId: string): HTMLElement[] {
  const editor = useStore.getState().settings.editor.instance
  if (!editor || editor.isDestroyed) return []

  const heading = editor.view.dom.querySelector(`[data-toc-id="${CSS.escape(headingId)}"]`)
  if (!(heading instanceof HTMLElement)) return []

  const level = headingLevel(heading)
  const out: HTMLElement[] = [heading]
  let el = heading.nextElementSibling
  while (el instanceof HTMLElement && out.length < PREVIEW_MAX_BLOCKS) {
    if (el.classList.contains('heading-fold-crinkle') || el.matches(PREVIEW_STRIP_SEL)) {
      el = el.nextElementSibling
      continue
    }
    const nextLevel = headingLevel(el)
    if (nextLevel != null && level != null && nextLevel <= level) break
    out.push(el)
    el = el.nextElementSibling
  }
  return out
}

function isMediaRoot(el: HTMLElement): boolean {
  return el.matches('[class*="hypermultimedia--"]') || el.matches(PREVIEW_MEDIA_SEL)
}

function hasPreviewMedia(el: HTMLElement): boolean {
  return el.matches(PREVIEW_MEDIA_SEL) || el.querySelector(PREVIEW_MEDIA_SEL) != null
}

function takeFirstMedia(root: HTMLElement): HTMLElement | null {
  if (isMediaRoot(root)) return root
  const media =
    root.querySelector<HTMLElement>('[class*="hypermultimedia--"]') ??
    root.querySelector<HTMLElement>(PREVIEW_MEDIA_SEL)
  media?.remove()
  return media ?? null
}

function stripLeftoverMedia(root: HTMLElement) {
  root.querySelectorAll('[class*="hypermultimedia--"]').forEach((node) => node.remove())
  root.querySelectorAll(PREVIEW_MEDIA_SEL).forEach((node) => node.remove())
}

function isPreviewNoise(el: HTMLElement): boolean {
  return !(el.textContent || '').replace(/\u00a0/g, ' ').trim()
}

function prunePreviewEmpties(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('p, div').forEach((el) => {
    if (el.querySelector(PREVIEW_MEDIA_SEL) || el.matches('[class*="hypermultimedia"]')) return
    if (isPreviewNoise(el)) el.remove()
  })
}

function fitPreviewMediaCover(node: HTMLElement) {
  const apply = (el: HTMLElement) => {
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.maxWidth = '100%'
    el.style.maxHeight = '100%'
    el.style.overflow = 'hidden'
    el.style.removeProperty('aspect-ratio')
  }
  apply(node)
  node.querySelectorAll<HTMLElement>('[class*="hypermultimedia"], .hm-media-host').forEach(apply)
  node.querySelectorAll<HTMLElement>(PREVIEW_MEDIA_SEL).forEach((el) => {
    el.removeAttribute('width')
    el.removeAttribute('height')
    apply(el)
    el.style.objectFit = 'cover'
  })
}

function preparePreviewClone(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.removeAttribute('data-toc-id')
  clone.removeAttribute('contenteditable')
  clone.classList.remove('heading-fold-hidden')
  clone.style.paddingRight = '0'
  clone.querySelectorAll(PREVIEW_STRIP_SEL).forEach((node) => node.remove())
  clone.querySelectorAll('[contenteditable]').forEach((node) => {
    node.removeAttribute('contenteditable')
  })
  clone.querySelectorAll('video, audio').forEach((media) => {
    const el = media as HTMLMediaElement
    el.removeAttribute('autoplay')
    el.controls = false
    el.preload = 'metadata'
    el.pause()
  })
  clone.querySelectorAll('iframe').forEach((frame) => {
    frame.setAttribute('tabindex', '-1')
    frame.setAttribute('loading', 'lazy')
  })
  return clone
}

function mountSectionPreview(host: HTMLElement, headingId: string, fallback: string) {
  host.replaceChildren()
  const sources = collectSectionElements(headingId)
  if (!sources.length) {
    host.textContent = fallback
    return
  }

  const prose = document.createElement('div')
  prose.className =
    'tiptap ProseMirror text-base-content min-h-0 px-2.5 pt-2 pb-1.5 text-xs leading-relaxed [&_.ha-wrap]:hidden [&_a]:text-primary [&_hr]:hidden [&_ol]:my-0.5 [&_pre]:p-1.5 [&_pre]:text-[10px] [&_ul]:my-0.5 [&_:is(h1,h2,h3,h4,h5,h6)]:!mt-0 [&_:is(h1,h2,h3,h4,h5,h6)]:!mb-1 [&_:is(h1,h2,h3,h4,h5,h6)]:!pr-0 [&_:is(h1,h2,h3,h4,h5,h6)]:!line-clamp-2 [&_:is(h1,h2,h3,h4,h5,h6)]:!text-sm [&_:is(h1,h2,h3,h4,h5,h6)]:!font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:!leading-snug [&_:is(h1,h2,h3,h4,h5,h6)]:!text-base-content'
  const body = document.createElement('div')
  body.className = 'text-base-content/70 [overflow-wrap:anywhere] line-clamp-3 [&_p]:!my-0'
  let heading: HTMLElement | null = null
  let media: HTMLElement | null = null

  for (const source of sources) {
    const clone = preparePreviewClone(source)
    const taken = takeFirstMedia(clone)
    if (taken && !media && hasPreviewMedia(taken)) media = taken
    if (taken === clone) continue
    stripLeftoverMedia(clone)
    prunePreviewEmpties(clone)
    if (isPreviewNoise(clone)) continue
    if (!heading && headingLevel(clone) != null) {
      heading = clone
      continue
    }
    body.appendChild(clone)
  }

  if (heading) prose.appendChild(heading)
  if (body.childNodes.length && !isPreviewNoise(body)) prose.appendChild(body)
  if (!prose.childNodes.length && fallback) prose.textContent = fallback
  if (prose.childNodes.length) host.appendChild(prose)

  if (media && hasPreviewMedia(media)) {
    const well = document.createElement('div')
    well.className = 'bg-base-200 h-24 w-full overflow-hidden'
    fitPreviewMediaCover(media)
    well.appendChild(media)
    host.appendChild(well)
  }
}

function PreviewSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-2.5 py-2.5" aria-hidden>
      <div className="skeleton rounded-field h-3.5 w-3/5" />
      <div className="skeleton rounded-field h-2.5 w-full" />
      <div className="skeleton rounded-field h-2.5 w-4/5" />
    </div>
  )
}

function TocSectionPreview({
  open,
  headingId,
  label,
  referenceEl
}: {
  open: boolean
  headingId: string | null
  label: string
  referenceEl: HTMLElement | null
}) {
  const { refs, floatingStyles, context } = useFloating({
    placement: 'right',
    strategy: 'fixed',
    transform: false,
    open,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8, limiter: limitShift({ offset: 16 }) })
    ],
    whileElementsMounted: autoUpdate
  })
  const { isMounted, styles: transitionStyles } = useOverlayTransition(context, {
    closeMs: 0
  })
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [empty, setEmpty] = useState(true)

  useLayoutEffect(() => {
    refs.setReference(referenceEl)
  }, [referenceEl, refs])

  useLayoutEffect(() => {
    if (!isMounted || !open || !headingId || !host) {
      setEmpty(true)
      host?.replaceChildren()
      return
    }
    mountSectionPreview(host, headingId, label)
    setEmpty(host.childNodes.length === 0)
    return () => {
      host.replaceChildren()
    }
  }, [headingId, host, isMounted, label, open])

  if (!isMounted) return null

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        aria-hidden
        style={{ ...floatingStyles, ...transitionStyles }}
        className={twMerge(
          popoverPanelClassName,
          'pointer-events-none w-64 max-w-[min(16rem,calc(100vw-3rem))] overflow-hidden p-0'
        )}>
        {empty && <PreviewSkeleton />}
        <div ref={setHost} className="flex min-h-0 flex-col" />
      </div>
    </FloatingPortal>
  )
}

function useTickHoverProximity(
  navRef: RefObject<HTMLElement | null>,
  items: TocItem[],
  setHover: (next: TickHoverState) => void
) {
  const lastRef = useRef(HOVER_IDLE)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    let pickRaf = 0
    let x = 0
    let y = 0
    let sawPointer = false

    const commit = (next: TickHoverState) => {
      const last = lastRef.current
      if (
        last.id === next.id &&
        last.inRail === next.inRail &&
        Math.abs(last.grow - next.grow) < 0.02
      ) {
        return
      }
      lastRef.current = next
      setHover(next)
    }

    const pick = () => {
      pickRaf = 0
      const list = itemsRef.current
      if (!list.length) return

      const rail = readRailGeometry(nav)
      const inBand = y >= rail.top && y <= rail.bottom
      const pastRight = x - rail.right
      const inRail = inBand && x >= rail.left && x <= rail.right
      const inSlop = inBand && pastRight > 0 && pastRight <= TICK_HOVER_SLOP_PX

      if (!inRail && !inSlop) {
        const active = document.activeElement
        if (
          active instanceof HTMLElement &&
          nav.contains(active) &&
          active.hasAttribute('data-toc-id') &&
          active.matches(':focus-visible')
        ) {
          commit({
            id: active.getAttribute('data-toc-id'),
            grow: 1,
            inRail: true
          })
          return
        }
        if (lastRef.current.id || lastRef.current.grow) commit(HOVER_IDLE)
        return
      }

      const index = Math.max(
        0,
        Math.min(list.length - 1, Math.round((y - rail.firstTop - TICK_ROW_PX / 2) / TICK_ROW_PX))
      )
      const id = list[index]?.id ?? null

      if (inRail) {
        commit({ id, grow: 1, inRail: true })
        return
      }

      const u = pastRight / TICK_HOVER_SLOP_PX
      commit({ id, grow: TICK_APPROACH_GROW * (1 - u * u), inRail: false })
    }

    const schedulePick = () => {
      if (!pickRaf) pickRaf = requestAnimationFrame(pick)
    }

    const refresh = () => {
      if (sawPointer) schedulePick()
    }

    const observer = new ResizeObserver(refresh)
    observer.observe(nav)
    nav.addEventListener('scroll', refresh, { passive: true })
    window.addEventListener('resize', refresh)
    window.addEventListener('chat-panel-resize-tick', refresh)

    const onMove = (event: PointerEvent) => {
      sawPointer = true
      x = event.clientX
      y = event.clientY
      schedulePick()
    }

    const onLeaveWindow = (event: PointerEvent) => {
      if (event.relatedTarget != null) return
      commit(HOVER_IDLE)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onLeaveWindow)
    return () => {
      observer.disconnect()
      nav.removeEventListener('scroll', refresh)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('chat-panel-resize-tick', refresh)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onLeaveWindow)
      if (pickRaf) cancelAnimationFrame(pickRaf)
    }
  }, [navRef, setHover])
}

function useChatRailReserve() {
  const chatOpen = useChatStore((s) => Boolean(s.chatRoom.headingId))
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!chatOpen) {
      setDragging(false)
      return
    }

    const onTick = () => {
      setDragging(true)
    }
    const onEnd = () => setDragging(false)
    window.addEventListener('chat-panel-resize-tick', onTick)
    window.addEventListener('chat-panel-resize-end', onEnd)
    return () => {
      window.removeEventListener('chat-panel-resize-tick', onTick)
      window.removeEventListener('chat-panel-resize-end', onEnd)
    }
  }, [chatOpen])

  return { dragging: chatOpen && dragging }
}

function useRailViewport(navRef: RefObject<HTMLElement | null>, itemCount: number) {
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0, viewH: 0 })

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return

    let raf = 0
    const apply = () => {
      const next = {
        scrollTop: nav.scrollTop,
        height: nav.clientHeight,
        viewH: window.innerHeight
      }
      setViewport((prev) =>
        prev.scrollTop === next.scrollTop &&
        prev.height === next.height &&
        prev.viewH === next.viewH
          ? prev
          : next
      )
    }
    const sync = () => {
      const max = Math.max(0, nav.scrollHeight - nav.clientHeight)
      if (nav.scrollTop > max) nav.scrollTop = max
      apply()
    }
    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        sync()
      })
    }

    sync()
    nav.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('chat-panel-resize-tick', schedule)
    window.addEventListener('chat-panel-resize-end', sync)
    const observer = new ResizeObserver(schedule)
    observer.observe(nav)
    return () => {
      nav.removeEventListener('scroll', sync)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('chat-panel-resize-tick', schedule)
      window.removeEventListener('chat-panel-resize-end', sync)
      observer.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [itemCount, navRef])

  return viewport
}

function useRailSpyFollow(
  navRef: RefObject<HTMLElement | null>,
  visible: TocItem[],
  skipRef: RefObject<TickHoverState>,
  spyTickId: string | null
) {
  const userScrollAtRef = useRef(0)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const mark = () => {
      userScrollAtRef.current = Date.now()
    }
    nav.addEventListener('wheel', mark, { passive: true })
    nav.addEventListener('pointerdown', mark)
    return () => {
      nav.removeEventListener('wheel', mark)
      nav.removeEventListener('pointerdown', mark)
    }
  }, [navRef])

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav || !spyTickId) return
    const skip = skipRef.current
    if (skip.inRail) return
    if (Date.now() - userScrollAtRef.current < RAIL_USER_SCROLL_LOCK_MS) return
    const index = visible.findIndex((item) => item.id === spyTickId)
    if (index < 0) return
    alignRailToSpy(nav, index, visible.length)
  }, [navRef, skipRef, spyTickId, visible])
}

const TocTick = memo(function TocTick({
  id,
  label,
  kind,
  grow,
  durationMs,
  onHover
}: {
  id: string
  label: string
  kind: TickKind
  grow: number
  durationMs: number
  onHover: (next: TickHoverState) => void
}) {
  const setFocusedHeadingWithLock = useFocusedHeadingStore((s) => s.setFocusedHeadingWithLock)

  const handleClick = useCallback(() => {
    setFocusedHeadingWithLock(id)
    tocActions.navigateToHeading(id, { openChat: false })
  }, [id, setFocusedHeadingWithLock])

  const enterRail = useCallback(() => {
    onHover({ id, grow: 1, inRail: true })
  }, [id, onHover])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onHover(HOVER_IDLE)
    },
    [onHover]
  )

  return (
    <button
      type="button"
      data-toc-id={id}
      aria-label={kind === 'chat' ? `${label}, chat open` : label}
      aria-current={kind === 'focused' ? 'true' : undefined}
      className="focus-visible:ring-primary flex h-2 w-full shrink-0 items-center justify-start px-0.5 focus-visible:ring-1 focus-visible:outline-none"
      onFocusCapture={enterRail}
      onBlur={(event) => {
        const nav = event.currentTarget.closest('nav')
        if (nav?.contains(event.relatedTarget as Node | null)) return
        onHover(HOVER_IDLE)
      }}
      onKeyDown={handleKeyDown}
      onClick={handleClick}>
      <span
        data-toc-tick=""
        className={twMerge(
          'inline-block origin-left rounded-full motion-safe:transition-[width,background-color] motion-safe:ease-out',
          tickDashClass(kind)
        )}
        style={{
          width: TICK_WIDTH.idle + (TICK_WIDTH[kind] - TICK_WIDTH.idle) * grow,
          transitionDuration: `${durationMs}ms`
        }}
      />
    </button>
  )
})

function neighborKind(distance: number): TickKind | null {
  if (distance === 1) return 'near'
  if (distance === 2) return 'mid'
  if (distance === 3) return 'far'
  return null
}

function tickKind(args: {
  isChatOpen: boolean
  isOpen: boolean
  isFocused: boolean
  neighbor: TickKind | null
}): TickKind {
  if (args.isChatOpen) return 'chat'
  if (args.isFocused) return 'focused'
  if (args.isOpen) return 'hover'
  if (args.neighbor) return args.neighbor
  return 'idle'
}

export function TocTickRail({ onOpenWide }: { onOpenWide: () => void }) {
  const { items } = useToc()
  const navRef = useRef<HTMLElement>(null)
  const chatReserve = useChatRailReserve()
  const viewport = useRailViewport(navRef, items.length)
  const focusedHeadingId = useFocusedHeadingStore((s) => s.focusedHeadingId)
  const chatHeadingId = useChatStore((s) => s.chatRoom.headingId)
  const folded = useMemo(() => visibleRailItems(items), [items])
  const maxTicks = maxRailTicks(viewport.height, viewport.viewH)
  const spyForFit = focusedHeadingId ?? chatHeadingId ?? null
  const visible = useMemo(
    () => fitRailItems(folded, maxTicks, spyForFit),
    [folded, maxTicks, spyForFit]
  )
  const spyTickId = visibleSpyId(items, visible, focusedHeadingId ?? null)
  const chatTickId = visibleSpyId(items, visible, chatHeadingId ?? null)
  const [hover, setHover] = useState<TickHoverState>(HOVER_IDLE)
  const hoverRef = useRef(hover)
  const setHoverAndRef = useCallback((next: TickHoverState) => {
    hoverRef.current = next
    setHover(next)
  }, [])
  const { start, end } = railWindow(viewport.scrollTop, viewport.height, visible.length)
  const stackH = visible.length * TICK_ROW_PX
  const stackOffset = railStackOffset(viewport.height, stackH)
  const [slideStack, setSlideStack] = useState(false)
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null)
  const hoverIndex = hover.id ? visible.findIndex((item) => item.id === hover.id) : -1
  const reduced = prefersReducedMotion()
  const proximityDurationMs = !reduced && hover.inRail ? MOTION_OVERLAY_IN_MS : 0
  const previewIntentId = hover.id && hover.inRail ? hover.id : null
  const [previewOpenId, setPreviewOpenId] = useState<string | null>(null)
  const previewOpen = previewOpenId != null && previewOpenId === previewIntentId
  const previewLabel = previewOpenId
    ? (visible.find((item) => item.id === previewOpenId)?.textContent ?? '')
    : ''
  useLayoutEffect(() => {
    if (!previewOpenId) return
    const el = navRef.current?.querySelector<HTMLElement>(
      `[data-toc-id="${CSS.escape(previewOpenId)}"] [data-toc-tick]`
    )
    if (el) setPreviewAnchor(el)
  }, [previewOpenId])

  useEffect(() => {
    if (hover.id && !visible.some((item) => item.id === hover.id)) setHoverAndRef(HOVER_IDLE)
  }, [hover.id, setHoverAndRef, visible])

  useEffect(() => {
    if (!previewIntentId) {
      setPreviewOpenId(null)
      return
    }
    setPreviewOpenId(null)
    const timer = window.setTimeout(
      () => setPreviewOpenId(previewIntentId),
      reduced ? 0 : PREVIEW_OPEN_MS
    )
    return () => window.clearTimeout(timer)
  }, [previewIntentId, reduced])

  useLayoutEffect(() => {
    if (reduced || chatReserve.dragging || viewport.height <= 0) {
      if (chatReserve.dragging) setSlideStack(false)
      return
    }
    if (slideStack) return
    const id = window.requestAnimationFrame(() => setSlideStack(true))
    return () => window.cancelAnimationFrame(id)
  }, [chatReserve.dragging, reduced, slideStack, viewport.height])

  useTickHoverProximity(navRef, visible, setHoverAndRef)
  useRailSpyFollow(navRef, visible, hoverRef, spyTickId)

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex shrink-0 justify-center pt-1.5 pb-0.5 motion-safe:animate-[doc-content-in_120ms_ease-out_both]">
        <Tooltip title="Show table of contents" placement="right">
          <button
            type="button"
            aria-label="Show table of contents"
            data-toc-rail-reopen
            className="btn btn-ghost btn-square btn-xs text-base-content/60 hover:text-base-content"
            onClick={onOpenWide}>
            <Icons.tableOfContents size={16} className="stroke-[1.75]" aria-hidden />
          </button>
        </Tooltip>
      </div>
      <nav
        ref={navRef}
        aria-label="Table of contents"
        className="scrollbar-custom min-h-0 w-full flex-1 scrollbar-thin overflow-y-auto py-0.5">
        <div className="flex min-h-full flex-col">
          <div
            data-toc-rail-stack
            className={twMerge(
              'relative w-full',
              slideStack &&
                'motion-safe:transition-transform motion-safe:duration-[var(--motion-panel)] motion-safe:ease-out'
            )}
            style={{
              height: stackH,
              transform: `translateY(${stackOffset}px)`
            }}>
            {visible.slice(start, end).map((item, offset) => {
              const index = start + offset
              const kind = tickKind({
                isChatOpen: chatTickId === item.id,
                isOpen: hover.id === item.id,
                isFocused: spyTickId === item.id,
                neighbor: hoverIndex >= 0 ? neighborKind(Math.abs(index - hoverIndex)) : null
              })
              const isProximity =
                kind === 'hover' || kind === 'near' || kind === 'mid' || kind === 'far'
              const grow = isProximity ? hover.grow : kind === 'idle' ? 0 : 1
              return (
                <div
                  key={item.id}
                  className="absolute inset-x-0"
                  style={{ top: index * TICK_ROW_PX, height: TICK_ROW_PX }}>
                  <TocTick
                    id={item.id}
                    label={item.textContent}
                    kind={kind}
                    grow={grow}
                    durationMs={isProximity ? proximityDurationMs : 0}
                    onHover={setHoverAndRef}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </nav>
      <TocSectionPreview
        open={previewOpen}
        headingId={previewOpenId}
        label={previewLabel}
        referenceEl={previewAnchor}
      />
    </div>
  )
}
