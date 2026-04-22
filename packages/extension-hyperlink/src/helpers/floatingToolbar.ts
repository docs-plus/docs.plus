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

export interface FloatingToolbarOptions {
  referenceElement?: HTMLElement
  /**
   * Live virtual-reference factory for anchors with no persistent DOM
   * node (e.g. a ProseMirror selection). `getBoundingClientRect` MUST
   * recompute on every call — caching breaks scroll-stickiness because
   * `position: fixed` + a frozen rect leaves the popover behind as the
   * anchor scrolls. Pass `contextElement` so `autoUpdate`'s scroll-
   * ancestor walk attaches to the right scroll container.
   */
  coordinates?: {
    getBoundingClientRect: () => { x: number; y: number; width: number; height: number }
    contextElement?: HTMLElement
  }
  content: HTMLElement
  placement?: Placement
  offset?: number
  showArrow?: boolean
  className?: string
  zIndex?: number
  onShow?: () => void
  onHide?: () => void
}

export interface FloatingToolbarInstance {
  element: HTMLElement
  show: () => void
  hide: () => void
  destroy: () => void
  isVisible: () => boolean
  setContent: (content: HTMLElement) => void
  updateReference: (
    referenceElement?: HTMLElement,
    coordinates?: FloatingToolbarOptions['coordinates']
  ) => void
}

export const DEFAULT_OFFSET = 8
const DEFAULT_Z_INDEX = 9999
const SHIFT_PADDING = 8
const ARROW_STATIC_OFFSET = '-5px'
const OUTSIDE_CLICK_DEFER_MS = 50

let currentToolbar: FloatingToolbarInstance | null = null

function createVirtualReference(
  coords: NonNullable<FloatingToolbarOptions['coordinates']>
): VirtualElement {
  return {
    getBoundingClientRect: () => {
      const { x, y, width, height } = coords.getBoundingClientRect()
      return {
        width,
        height,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
        x,
        y
      }
    },
    contextElement: coords.contextElement || document.body
  }
}

function setupKeyboardNav(container: HTMLElement): void {
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable.length) return

  focusable.forEach((el, i) => {
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      const next = e.shiftKey
        ? (i - 1 + focusable.length) % focusable.length
        : (i + 1) % focusable.length
      focusable[next].focus()
    })
  })
}

export function createFloatingToolbar(options: FloatingToolbarOptions): FloatingToolbarInstance {
  currentToolbar?.destroy()

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

  if (!referenceElement && !coordinates) {
    throw new Error('Either referenceElement or coordinates must be provided')
  }

  let reference: ReferenceElement = referenceElement || createVirtualReference(coordinates!)
  const cleanups: (() => void)[] = []
  let visible = false
  let autoUpdateCleanup: (() => void) | null = null

  const toolbar = document.createElement('div')
  toolbar.className = `floating-toolbar ${className}`.trim()
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('tabindex', '-1')
  toolbar.style.zIndex = String(zIndex)
  toolbar.style.position = 'fixed'

  let arrowEl: HTMLElement | null = null
  if (showArrow) {
    arrowEl = document.createElement('div')
    arrowEl.className = 'floating-toolbar-arrow'
    toolbar.appendChild(arrowEl)
  }

  const contentContainer = document.createElement('div')
  contentContainer.className = 'floating-toolbar-content'
  toolbar.appendChild(contentContainer)

  const setContent = (el: HTMLElement): void => {
    contentContainer.innerHTML = ''
    contentContainer.appendChild(el)
    setupKeyboardNav(toolbar)
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
    } = await computePosition(reference, toolbar, {
      placement,
      strategy: 'fixed',
      middleware
    })

    if (!visible) return

    Object.assign(toolbar.style, { left: `${x}px`, top: `${y}px` })

    // Hide when reference scrolls out of view
    toolbar.style.visibility = middlewareData.hide?.referenceHidden ? 'hidden' : 'visible'

    if (arrowEl && middlewareData.arrow) {
      const { x: ax, y: ay } = middlewareData.arrow
      const side = actual.split('-')[0]
      const staticSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[side]!

      arrowEl.className = `floating-toolbar-arrow floating-toolbar-arrow-${side}`
      Object.assign(arrowEl.style, {
        left: ax != null ? `${ax}px` : '',
        top: ay != null ? `${ay}px` : '',
        right: '',
        bottom: '',
        [staticSide]: ARROW_STATIC_OFFSET
      })
    }
  }

  const hide = (): void => {
    if (!visible) return
    visible = false

    autoUpdateCleanup?.()
    autoUpdateCleanup = null

    toolbar.classList.remove('visible')
    toolbar.remove()

    cleanups.forEach((fn) => fn())
    cleanups.length = 0

    onHide?.()
  }

  const show = (): void => {
    if (visible) return

    document.body.appendChild(toolbar)
    visible = true

    autoUpdateCleanup = autoUpdate(reference, toolbar, updatePosition)

    requestAnimationFrame(() => toolbar.classList.add('visible'))

    // Defer outside-click listener so the triggering event doesn't immediately close
    setTimeout(() => {
      if (!visible) return

      const onMouseDown = (e: MouseEvent) => {
        if (!toolbar.contains(e.target as Node)) hide()
      }
      const onTouchStart = (e: TouchEvent) => {
        if (!e.touches.length) return
        const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)
        if (!toolbar.contains(target)) hide()
      }

      document.addEventListener('mousedown', onMouseDown, { passive: true })
      document.addEventListener('touchstart', onTouchStart, { passive: true })
      cleanups.push(
        () => document.removeEventListener('mousedown', onMouseDown),
        () => document.removeEventListener('touchstart', onTouchStart)
      )
    }, OUTSIDE_CLICK_DEFER_MS)

    // Escape key
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        hide()
      }
    }
    toolbar.addEventListener('keydown', onKeyDown)
    cleanups.push(() => toolbar.removeEventListener('keydown', onKeyDown))

    onShow?.()
  }

  const destroy = (): void => {
    hide()
    if (currentToolbar === instance) currentToolbar = null
  }

  const instance: FloatingToolbarInstance = {
    element: toolbar,
    show,
    hide,
    destroy,
    isVisible: () => visible,
    setContent,
    updateReference: (ref?: HTMLElement, coords?: FloatingToolbarOptions['coordinates']) => {
      if (ref) reference = ref
      else if (coords) reference = createVirtualReference(coords)
      // `autoUpdate` was bound to the *previous* reference's scroll ancestors.
      // If the new reference lives in a different overflow container (likely
      // when callers swap virtual → real DOM, or move across panes), those
      // listeners are stale and the popover stops following scroll. Tear
      // down and re-subscribe so the listener set tracks the live reference.
      if (visible) {
        autoUpdateCleanup?.()
        autoUpdateCleanup = autoUpdate(reference, toolbar, updatePosition)
      } else {
        updatePosition()
      }
    }
  }

  currentToolbar = instance
  return instance
}

export const hideCurrentToolbar = (): void => {
  currentToolbar?.hide()
}

export const updateCurrentToolbarPosition = (
  referenceElement?: HTMLElement,
  coordinates?: FloatingToolbarOptions['coordinates']
): void => {
  currentToolbar?.updateReference(referenceElement, coordinates)
}
