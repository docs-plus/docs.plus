import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useEffect,
  useRef,
  useState
} from 'react'

import { tocActions } from '../hooks'
import { inPreviewCorridor, type Point } from './previewCorridor'

/** Dwell on one tick before its card opens. Reduced motion keeps it: it is input, not motion. */
export const PREVIEW_OPEN_MS = 80
/** Grace after the pointer leaves the tick, the corridor and the card. */
export const PREVIEW_CLOSE_MS = 120

export type RailPointerSample =
  | { kind: 'rail'; x: number; y: number; tickId: string | null }
  | { kind: 'off'; x: number; y: number }
  | { kind: 'gone' }

type Suppressed = { id: string; pointer: boolean; focus: boolean }

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusNextAfter(from: HTMLElement, skip: HTMLElement | null): boolean {
  const all = Array.from(document.querySelectorAll<HTMLElement>(TABBABLE))
  const next = all.find(
    (el) =>
      from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING &&
      !skip?.contains(el) &&
      el.tabIndex >= 0 &&
      !el.closest('[inert]') &&
      el.getClientRects().length > 0
  )
  if (!next) return false
  next.focus()
  return true
}

/**
 * Who owns the section preview: pointer (dwell, corridor, grace) or keyboard focus.
 * One controller per rail; every timer checks it still belongs to the open heading.
 */
export function useRailPreview(navRef: RefObject<HTMLElement | null>) {
  const [openId, setOpenIdState] = useState<string | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  const actionRef = useRef<HTMLButtonElement | null>(null)

  const [api] = useState(() => {
    let open: string | null = null
    let keyboard: string | null = null
    let from: Point | null = null
    let lastPoint: Point | null = null
    let tickUnderPointer: string | null = null
    let holds = false
    let dwell: { id: string; timer: number } | null = null
    let grace = 0
    let gen = 0
    let suppressed: Suppressed | null = null

    const cancelDwell = () => {
      if (dwell) window.clearTimeout(dwell.timer)
      dwell = null
    }
    const cancelGrace = () => {
      if (grace) window.clearTimeout(grace)
      grace = 0
    }
    const setOpen = (id: string | null) => {
      if (id === open) return
      open = id
      gen += 1
      holds = false
      cancelGrace()
      if (!id) {
        from = null
        keyboard = null
      }
      setOpenIdState(id)
    }
    const settleSuppressed = () => {
      if (suppressed && !suppressed.pointer && !suppressed.focus) suppressed = null
    }
    const trigger = (id: string) =>
      navRef.current?.querySelector<HTMLElement>(`[data-toc-id="${CSS.escape(id)}"]`) ?? null

    const startDwell = (id: string) => {
      cancelDwell()
      const timer = window.setTimeout(() => {
        if (dwell?.timer !== timer) return
        dwell = null
        if (keyboard || tickUnderPointer !== id) return
        setOpen(id)
        from = lastPoint
        holds = true
      }, PREVIEW_OPEN_MS)
      dwell = { id, timer }
    }
    // Once per exit: continuous movement outside must not push the close back.
    const startGrace = () => {
      if (grace || !open) return
      const owner = gen
      grace = window.setTimeout(() => {
        grace = 0
        if (owner !== gen || keyboard || holds) return
        setOpen(null)
      }, PREVIEW_CLOSE_MS)
    }
    const releaseKeyboard = () => {
      keyboard = null
      if (open && !holds) setOpen(null)
    }

    const dismiss = ({ suppressFocus }: { suppressFocus: boolean }) => {
      const id = open
      if (!id) return
      suppressed = { id, pointer: tickUnderPointer === id, focus: suppressFocus }
      settleSuppressed()
      cancelDwell()
      setOpen(null)
    }

    const pointer = (sample: RailPointerSample) => {
      const point = sample.kind === 'gone' ? null : { x: sample.x, y: sample.y }
      lastPoint = point
      tickUnderPointer = sample.kind === 'rail' ? sample.tickId : null
      if (suppressed && tickUnderPointer !== suppressed.id) {
        suppressed.pointer = false
        settleSuppressed()
      }

      if (sample.kind === 'rail') {
        holds = open != null && sample.tickId === open
      } else {
        const card = cardRef.current?.getBoundingClientRect()
        holds =
          open != null &&
          point != null &&
          card != null &&
          card.width > 0 &&
          (from
            ? inPreviewCorridor(point, from, card)
            : point.x >= card.left &&
              point.x <= card.right &&
              point.y >= card.top &&
              point.y <= card.bottom)
      }

      // Keyboard focus owns the heading: scrubbing cannot replace its card.
      if (keyboard) {
        cancelDwell()
        return
      }

      if (sample.kind === 'rail' && sample.tickId) {
        const id = sample.tickId
        if (id === open) {
          from = point
          cancelDwell()
          cancelGrace()
          return
        }
        if (open) setOpen(null)
        if (suppressed?.pointer && suppressed.id === id) {
          cancelDwell()
          return
        }
        if (dwell?.id !== id) startDwell(id)
        return
      }

      cancelDwell()
      if (!open) return
      // Empty rail is not a departure toward the card.
      if (sample.kind === 'rail') from = null
      if (holds) cancelGrace()
      else startGrace()
    }

    return {
      pointer,
      dismiss,
      /** True while pointer work must run: a dwell, a card, or keyboard ownership. */
      isBusy: () => open != null || dwell != null || keyboard != null,

      /** Drops a card whose heading or anchor is gone, with no suppression. */
      drop: () => {
        cancelDwell()
        setOpen(null)
      },

      tickFocus: (event: FocusEvent<HTMLElement>, id: string) => {
        // Mouse-click focus does not bypass the dwell or pin the card.
        if (!event.currentTarget.matches(':focus-visible')) return
        if (suppressed?.focus && suppressed.id === id) return
        cancelDwell()
        setOpen(id)
        keyboard = id
        from = null
        cancelGrace()
      },

      tickBlur: (event: FocusEvent<HTMLElement>, id: string) => {
        if (suppressed?.id === id) {
          suppressed.focus = false
          settleSuppressed()
        }
        if (cardRef.current?.contains(event.relatedTarget as Node | null)) return
        if (keyboard === id) releaseKeyboard()
      },

      tickKeyDown: (event: KeyboardEvent<HTMLElement>, id: string) => {
        if (open !== id) return
        if (event.key === 'Escape') {
          event.stopPropagation()
          dismiss({ suppressFocus: true })
          return
        }
        if (event.key === 'Tab' && !event.shiftKey && actionRef.current) {
          event.preventDefault()
          actionRef.current.focus()
        }
      },

      cardFocus: () => {
        if (!open) return
        keyboard = open
        cancelDwell()
        cancelGrace()
      },

      cardBlur: (event: FocusEvent<HTMLElement>) => {
        const next = event.relatedTarget as HTMLElement | null
        if (cardRef.current?.contains(next)) return
        if (open && next && next === trigger(open)) return
        releaseKeyboard()
      },

      cardKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const id = open
        if (!id) return
        if (event.key === 'Escape') {
          event.stopPropagation()
          event.preventDefault()
          dismiss({ suppressFocus: true })
          const back = trigger(id) ?? document.querySelector<HTMLElement>('[data-toc-rail-reopen]')
          back?.focus({ preventScroll: true })
          return
        }
        if (event.key !== 'Tab') return
        const tick = trigger(id)
        if (!tick) return
        if (event.shiftKey) {
          event.preventDefault()
          tick.focus({ preventScroll: true })
          return
        }
        if (focusNextAfter(tick, cardRef.current)) event.preventDefault()
      },

      // The composer takes focus next, so focus must not go back to the tick.
      openChat: (event: MouseEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()
        const id = open
        if (!id) return
        dismiss({ suppressFocus: false })
        tocActions.openChatroom(id, { focusEditor: true })
      },

      destroy: () => {
        cancelDwell()
        cancelGrace()
      }
    }
  })

  useEffect(() => api.destroy, [api])

  // Escape anywhere and a press outside the rail and card close it at once.
  useEffect(() => {
    if (!openId) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') api.dismiss({ suppressFocus: false })
    }
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (cardRef.current?.contains(target) || navRef.current?.contains(target)) return
      api.dismiss({ suppressFocus: false })
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [api, navRef, openId])

  return { openId, api, cardRef, actionRef }
}

export type RailPreviewApi = ReturnType<typeof useRailPreview>['api']
