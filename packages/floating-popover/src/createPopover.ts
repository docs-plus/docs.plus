import {
  arrow,
  autoUpdate,
  computePosition,
  flip,
  hide as hideMiddleware,
  offset,
  type Placement,
  type ReferenceElement,
  shift,
  type VirtualElement
} from '@floating-ui/dom'

import { getDefaultController, type VirtualCoordinates } from './controller'

type PopoverAnchor =
  | { referenceElement: HTMLElement; coordinates?: never }
  | { referenceElement?: never; coordinates: VirtualCoordinates }

type PopoverShellOptions = {
  content: HTMLElement
  placement?: Placement
  offset?: number
  showArrow?: boolean
  className?: string
  zIndex?: number
  onShow?: () => void
  onHide?: () => void
}

export type PopoverOptions = PopoverAnchor & PopoverShellOptions

export interface Popover {
  element: HTMLElement
  show: () => void
  hide: () => void
  destroy: () => void
  isVisible: () => boolean
  setContent: (content: HTMLElement) => void
  updateReference: (referenceElement?: HTMLElement, coordinates?: VirtualCoordinates) => void
}

export const DEFAULT_OFFSET = 8
const DEFAULT_Z_INDEX = 9999
const SHIFT_PADDING = 8
const ARROW_STATIC_OFFSET = '-5px'
const OUTSIDE_CLICK_DEFER_MS = 50
// Covers the skins' 80ms exit; transitionend never fires under display:none or
// prefers-reduced-motion `transition: none`, so removal cannot rely on it alone.
const EXIT_FALLBACK_MS = 150

const ORIGIN_BY_SIDE: Record<string, string> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left'
}

function createVirtualReference(coords: VirtualCoordinates): VirtualElement {
  return {
    getBoundingClientRect: () => {
      const { x, y, width, height } = coords.getBoundingClientRect()
      return { width, height, top: y, right: x + width, bottom: y + height, left: x, x, y }
    },
    contextElement: coords.contextElement || document.body
  }
}

// Wraps focusables in a Tab cycle. Returns removers so each `setContent`
// can drop the prior batch before re-binding — without it the per-focusable
// `keydown` listeners leaked across content swaps and on destroy.
function setupKeyboardNav(container: HTMLElement): Array<() => void> {
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable.length) return []
  const removers: Array<() => void> = []
  focusable.forEach((el, i) => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      const next = e.shiftKey
        ? (i - 1 + focusable.length) % focusable.length
        : (i + 1) % focusable.length
      focusable[next].focus()
    }
    el.addEventListener('keydown', onKeydown)
    removers.push(() => el.removeEventListener('keydown', onKeydown))
  })
  return removers
}

export function createPopover(options: PopoverOptions): Popover {
  const controller = getDefaultController()

  const {
    referenceElement,
    coordinates,
    content,
    placement = 'bottom-start',
    offset: offsetVal = DEFAULT_OFFSET,
    showArrow = false,
    className = '',
    zIndex = DEFAULT_Z_INDEX,
    onShow,
    onHide
  } = options

  // Defence-in-depth for `any`-typed and JS-only callers; the discriminated
  // union in `PopoverOptions` already makes this case a compile error.
  if (!referenceElement && !coordinates) {
    throw new Error('Either referenceElement or coordinates must be provided')
  }

  let reference: ReferenceElement = referenceElement || createVirtualReference(coordinates!)
  const cleanups: (() => void)[] = []
  let visible = false
  let autoUpdateCleanup: (() => void) | null = null

  const root = document.createElement('div')
  root.className = `floating-popover ${className}`.trim()
  root.setAttribute('role', 'toolbar')
  root.setAttribute('tabindex', '-1')
  root.style.zIndex = String(zIndex)
  root.style.position = 'fixed'

  let arrowEl: HTMLElement | null = null
  if (showArrow) {
    arrowEl = document.createElement('div')
    arrowEl.className = 'floating-popover-arrow'
    root.appendChild(arrowEl)
  }

  const contentContainer = document.createElement('div')
  contentContainer.className = 'floating-popover-content'
  root.appendChild(contentContainer)

  const navListeners: Array<() => void> = []
  const clearNavListeners = (): void => {
    while (navListeners.length) navListeners.pop()!()
  }

  const setContent = (el: HTMLElement): void => {
    clearNavListeners()
    contentContainer.innerHTML = ''
    contentContainer.appendChild(el)
    navListeners.push(...setupKeyboardNav(root))
  }

  setContent(content)

  const updatePosition = async (): Promise<void> => {
    if (!visible) return
    const middleware = [offset(offsetVal), flip(), shift({ padding: SHIFT_PADDING })]
    if (arrowEl) middleware.push(arrow({ element: arrowEl }))
    middleware.push(hideMiddleware({ strategy: 'referenceHidden' }))

    const {
      x,
      y,
      placement: actual,
      middlewareData
    } = await computePosition(reference, root, {
      placement,
      strategy: 'fixed',
      middleware
    })
    if (!visible) return
    Object.assign(root.style, { left: `${x}px`, top: `${y}px` })
    root.style.visibility = middlewareData.hide?.referenceHidden ? 'hidden' : 'visible'

    const side = actual.split('-')[0]
    // Scale blooms from the anchored side instead of center.
    root.style.transformOrigin = ORIGIN_BY_SIDE[side] ?? 'center'

    if (arrowEl && middlewareData.arrow) {
      const { x: ax, y: ay } = middlewareData.arrow
      // Arrow pins to the side opposite the placement — the same mapping.
      const staticSide = ORIGIN_BY_SIDE[side]!
      arrowEl.className = `floating-popover-arrow floating-popover-arrow-${side}`
      Object.assign(arrowEl.style, {
        left: ax != null ? `${ax}px` : '',
        top: ay != null ? `${ay}px` : '',
        right: '',
        bottom: '',
        [staticSide]: ARROW_STATIC_OFFSET
      })
    }
  }

  let unregister: (() => void) | null = null
  let removalTimer: ReturnType<typeof setTimeout> | null = null
  let onExitEnd: ((e: TransitionEvent) => void) | null = null

  const cancelPendingRemoval = (): void => {
    if (removalTimer) {
      clearTimeout(removalTimer)
      removalTimer = null
    }
    if (onExitEnd) {
      root.removeEventListener('transitionend', onExitEnd)
      onExitEnd = null
    }
  }

  const finishHide = (): void => {
    cancelPendingRemoval()
    root.remove()
  }

  const hide = (): void => {
    if (!visible) return
    visible = false
    autoUpdateCleanup?.()
    autoUpdateCleanup = null
    clearNavListeners()
    cleanups.forEach((fn) => fn())
    cleanups.length = 0
    unregister?.()
    unregister = null
    // Removing .visible plays the skin's exit transition; the DOM node leaves on
    // transitionend, with the fallback timer as the guarantee.
    root.classList.remove('visible')
    onExitEnd = (e) => {
      if (e.target === root) finishHide()
    }
    root.addEventListener('transitionend', onExitEnd)
    removalTimer = setTimeout(finishHide, EXIT_FALLBACK_MS)
    onHide?.()
  }

  const show = (): void => {
    if (visible) return
    // Re-show during an in-flight exit must not race the deferred removal.
    cancelPendingRemoval()
    document.body.appendChild(root)
    visible = true
    autoUpdateCleanup = autoUpdate(reference, root, updatePosition)
    requestAnimationFrame(() => root.classList.add('visible'))
    setTimeout(() => {
      if (!visible) return
      const onMouseDown = (e: MouseEvent) => {
        if (!root.contains(e.target as Node)) hide()
      }
      const onTouchStart = (e: TouchEvent) => {
        if (!e.touches.length) return
        const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)
        if (!root.contains(target)) hide()
      }
      document.addEventListener('mousedown', onMouseDown, { passive: true })
      document.addEventListener('touchstart', onTouchStart, { passive: true })
      cleanups.push(
        () => document.removeEventListener('mousedown', onMouseDown),
        () => document.removeEventListener('touchstart', onTouchStart)
      )
    }, OUTSIDE_CLICK_DEFER_MS)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        hide()
      }
    }
    root.addEventListener('keydown', onKeyDown)
    cleanups.push(() => root.removeEventListener('keydown', onKeyDown))
    onShow?.()
  }

  const destroy = (): void => {
    hide()
    // Teardown is immediate — destroy callers replace or unmount the surface.
    finishHide()
  }

  const popover: Popover = {
    element: root,
    show,
    hide,
    destroy,
    isVisible: () => visible,
    setContent,
    updateReference: (ref?: HTMLElement, coords?: VirtualCoordinates) => {
      if (ref) reference = ref
      else if (coords) reference = createVirtualReference(coords)
      if (visible) {
        autoUpdateCleanup?.()
        autoUpdateCleanup = autoUpdate(reference, root, updatePosition)
      } else {
        updatePosition()
      }
    }
  }

  unregister = controller.adopt(popover, 'unknown', {
    element: root,
    referenceElement: referenceElement ?? null
  })
  return popover
}
