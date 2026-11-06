import { headingLabel } from '@components/TipTap/placeholders'
import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore } from '@stores'
import type { TocItem } from '@types'
import { MOTION_OVERLAY_IN_MS, prefersReducedMotion } from '@utils/motion'
import { twMerge } from '@utils/twMerge'
import {
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
import {
  planRail,
  railLayout,
  railSpyScrollTop,
  railTickBudget,
  TICK_ROW_PX
} from './rail/planRail'
import { TocSectionPreview } from './rail/TocSectionPreview'
import { type RailPreviewApi, useRailPreview } from './rail/useRailPreview'

const RAIL_USER_SCROLL_LOCK_MS = 800
const TICK_HOVER_SLOP_PX = 72
const TICK_APPROACH_GROW = 0.78
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

type RailGeometry = {
  top: number
  left: number
  right: number
  bottom: number
  firstTop: number
}

function tickLabel(item: TocItem): string {
  return headingLabel({ text: item.textContent, level: item.level })
}

function alignRailToSpy(nav: HTMLElement, index: number, count: number) {
  // A rail that cannot scroll already sits at 0, which is all the full path could set.
  if (nav.scrollHeight <= nav.clientHeight) return
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

function useTickHoverProximity(
  navRef: RefObject<HTMLElement | null>,
  items: TocItem[],
  setHover: (next: TickHoverState) => void,
  preview: RailPreviewApi
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
    // Horizontal span from the last pick. Never cache firstTop: the stack tween moves it.
    let span: { left: number; right: number } | null = null

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
      const rail = readRailGeometry(nav)
      span = { left: rail.left, right: rail.right }

      // Only a real tick row owns the preview; the band below is for dash growth only.
      const onRail = x >= rail.left && x <= rail.right && y >= rail.top && y <= rail.bottom
      const row = Math.floor((y - rail.firstTop) / TICK_ROW_PX)
      const tickId = onRail && row >= 0 && row < list.length ? list[row].id : null
      preview.pointer(onRail ? { kind: 'rail', x, y, tickId } : { kind: 'off', x, y })
      if (!list.length) return

      // A short centered stack leaves empty rail above and below; that space is not a tick.
      const stackTop = Math.max(rail.top, rail.firstTop - TICK_HOVER_SLOP_PX)
      const stackBottom = Math.min(
        rail.bottom,
        rail.firstTop + list.length * TICK_ROW_PX + TICK_HOVER_SLOP_PX
      )
      const inBand = y >= stackTop && y <= stackBottom
      const pastRight = x - rail.right
      const inRail = inBand && x >= rail.left && x <= rail.right
      const inSlop = inBand && pastRight > 0 && pastRight <= TICK_HOVER_SLOP_PX

      if (!inRail && !inSlop) {
        if (lastRef.current.id || lastRef.current.grow) commit(HOVER_IDLE)
        return
      }

      // The band reaches past the stack, so clamp the row to the nearest tick.
      const index = Math.max(0, Math.min(list.length - 1, row))
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
      span = null
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
      // Skip only moves where pick would change nothing: far in x, idle, no preview work.
      if (
        span &&
        (x < span.left || x > span.right + TICK_HOVER_SLOP_PX) &&
        !(lastRef.current.id || lastRef.current.grow) &&
        !preview.isBusy()
      ) {
        return
      }
      schedulePick()
    }

    const onLeaveWindow = (event: PointerEvent) => {
      if (event.relatedTarget != null) return
      commit(HOVER_IDLE)
      preview.pointer({ kind: 'gone' })
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
  }, [navRef, preview, setHover])
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
  pausedRef: RefObject<boolean>,
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
    if (pausedRef.current) return
    if (Date.now() - userScrollAtRef.current < RAIL_USER_SCROLL_LOCK_MS) return
    const index = visible.findIndex((item) => item.id === spyTickId)
    if (index < 0) return
    alignRailToSpy(nav, index, visible.length)
  }, [navRef, pausedRef, spyTickId, visible])
}

const TocTick = memo(function TocTick({
  id,
  label,
  kind,
  grow,
  durationMs,
  preview
}: {
  id: string
  label: string
  kind: TickKind
  grow: number
  durationMs: number
  preview: RailPreviewApi
}) {
  const handleClick = useCallback(() => {
    tocActions.navigateToHeading(id, { openChat: false })
  }, [id])

  return (
    <button
      type="button"
      data-toc-id={id}
      aria-label={kind === 'chat' ? `${label}, chat open` : label}
      aria-current={kind === 'focused' ? 'true' : undefined}
      className="focus-visible:ring-primary flex h-2 w-full shrink-0 items-center justify-start px-0.5 focus-visible:ring-1 focus-visible:outline-none"
      onFocus={(event) => preview.tickFocus(event, id)}
      onBlur={(event) => preview.tickBlur(event, id)}
      onKeyDown={(event) => preview.tickKeyDown(event, id)}
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
  const plan = useMemo(() => planRail(items), [items])
  const maxTicks = railTickBudget(viewport.height, viewport.viewH)
  const spyForFit = focusedHeadingId ?? chatHeadingId ?? null
  const visible = useMemo(() => plan.fit(maxTicks, spyForFit), [plan, maxTicks, spyForFit])
  const spyTickId = plan.tickFor(visible, focusedHeadingId ?? null)
  const chatTickId = plan.tickFor(visible, chatHeadingId ?? null)
  const [hover, setHover] = useState<TickHoverState>(HOVER_IDLE)
  const { start, end, stackH, stackOffset } = railLayout({
    count: visible.length,
    scrollTop: viewport.scrollTop,
    height: viewport.height
  })
  const [slideStack, setSlideStack] = useState(false)
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null)
  const hoverIndex = hover.id ? visible.findIndex((item) => item.id === hover.id) : -1
  const reduced = prefersReducedMotion()
  const proximityDurationMs = !reduced && hover.inRail ? MOTION_OVERLAY_IN_MS : 0
  const { openId: previewId, api: preview, cardRef, actionRef } = useRailPreview(navRef)
  const previewItem = previewId ? visible.find((item) => item.id === previewId) : null
  const previewLabel = previewItem ? tickLabel(previewItem) : ''
  // Spy follow must not scroll the rail under a reader who is using it or its card.
  const spyPausedRef = useRef(false)
  spyPausedRef.current = hover.inRail || previewId != null

  // A heading that left the rail, or a tick that scrolled out of view, takes its card with it.
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!previewId || !nav) {
      setPreviewAnchor(null)
      return
    }
    const el = nav.querySelector<HTMLElement>(
      `[data-toc-id="${CSS.escape(previewId)}"] [data-toc-tick]`
    )
    const box = el?.getBoundingClientRect()
    const rail = nav.getBoundingClientRect()
    if (!el || !box || box.bottom < rail.top || box.top > rail.bottom) {
      preview.drop()
      return
    }
    setPreviewAnchor(el)
  }, [navRef, preview, previewId, start, end, viewport.scrollTop, viewport.height, visible])

  useEffect(() => {
    if (hover.id && !visible.some((item) => item.id === hover.id)) setHover(HOVER_IDLE)
  }, [hover.id, setHover, visible])

  useLayoutEffect(() => {
    if (reduced || chatReserve.dragging || viewport.height <= 0) {
      if (chatReserve.dragging) setSlideStack(false)
      return
    }
    if (slideStack) return
    const id = window.requestAnimationFrame(() => setSlideStack(true))
    return () => window.cancelAnimationFrame(id)
  }, [chatReserve.dragging, reduced, slideStack, viewport.height])

  useTickHoverProximity(navRef, visible, setHover, preview)
  useRailSpyFollow(navRef, visible, spyPausedRef, spyTickId)

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
                isOpen: hover.id === item.id || previewId === item.id,
                isFocused: spyTickId === item.id,
                neighbor: hoverIndex >= 0 ? neighborKind(Math.abs(index - hoverIndex)) : null
              })
              const isProximity =
                kind === 'hover' || kind === 'near' || kind === 'mid' || kind === 'far'
              const grow =
                previewId === item.id ? 1 : isProximity ? hover.grow : kind === 'idle' ? 0 : 1
              return (
                <div
                  key={item.id}
                  className="absolute inset-x-0"
                  style={{ top: index * TICK_ROW_PX, height: TICK_ROW_PX }}>
                  <TocTick
                    id={item.id}
                    label={tickLabel(item)}
                    kind={kind}
                    grow={grow}
                    durationMs={isProximity ? proximityDurationMs : 0}
                    preview={preview}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </nav>
      <TocSectionPreview
        headingId={previewId}
        label={previewLabel}
        referenceEl={previewAnchor}
        api={preview}
        cardRef={cardRef}
        actionRef={actionRef}
      />
    </div>
  )
}
