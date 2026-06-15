import Button from '@components/ui/Button'
import { Tooltip } from '@components/ui/Tooltip'
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  Placement,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole
} from '@floating-ui/react'
import debounce from 'lodash/debounce'
import {
  createContext,
  type CSSProperties,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { twMerge } from 'tailwind-merge'

import { useOverlayTransition } from './useOverlayTransition'

// Global state for managing multiple HoverMenus
class HoverMenuManager {
  private currentOpenMenu: string | null = null
  private menus: Map<string, () => void> = new Map()

  register(id: string, closeCallback: () => void) {
    this.menus.set(id, closeCallback)
  }

  unregister(id: string) {
    this.menus.delete(id)
  }

  open(id: string) {
    // Close current menu if different
    if (this.currentOpenMenu && this.currentOpenMenu !== id) {
      const closeCallback = this.menus.get(this.currentOpenMenu)
      closeCallback?.()
    }
    this.currentOpenMenu = id
  }

  close(id: string) {
    if (this.currentOpenMenu === id) {
      this.currentOpenMenu = null
    }
  }
}

const hoverMenuManager = new HoverMenuManager()

type ScrollParentResolver = () => Element | Window | null

type BoundaryResolver = () => Element | null

interface HoverMenuOptions {
  placement?: Placement
  offset?: number
  delay?: number | { open?: number; close?: number }
  disabled?: boolean
  scrollParent?: Element | Window | ScrollParentResolver | null
  /** Opt-in portal target id (find-or-create per FloatingPortal docs).
   *  Default unset → mounts to body. Pass an id matching a DOM element
   *  inside a parent stacking context to escape z-index war with that
   *  context's other children (toolbars, jump-to-present, etc.). */
  portalId?: string
  /** Floating-UI flip/shift boundary. Resolved at lookup time so the
   *  boundary element can mount after this hook (e.g., chatroom panel
   *  with `.group/chat` wrapper). When set, the menu CANNOT render
   *  outside this rectangle — flip swaps top↔bottom and shift clamps
   *  left/right when the default placement would overflow. This is the
   *  correct fix when `position: fixed` portals would otherwise float
   *  over toolbars / outside their visual container; z-index can't
   *  constrain that because fixed-positioned elements are viewport-
   *  relative, not parent-relative. */
  boundary?: Element | BoundaryResolver | null
}

interface HoverMenuContextType {
  open: boolean
  setOpen: (open: boolean) => void
  refs: ReturnType<typeof useFloating>['refs']
  floatingStyles: CSSProperties
  context: ReturnType<typeof useFloating>['context']
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps']
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps']
  openDropdownCount: number
  incrementDropdownCount: () => void
  decrementDropdownCount: () => void
}

const HoverMenuContext = createContext<HoverMenuContextType | null>(null)

export const useHoverMenuContext = () => {
  const context = useContext(HoverMenuContext)
  if (!context) {
    throw new Error('HoverMenu components must be wrapped in <HoverMenu />')
  }
  return context
}

const resolveScrollTargets = (
  scrollParent: HoverMenuOptions['scrollParent']
): Array<Element | Window> => {
  if (!scrollParent || typeof window === 'undefined') {
    return []
  }

  if (typeof scrollParent === 'function') {
    const resolved = scrollParent()
    return resolved ? [resolved] : []
  }

  return [scrollParent]
}

function useHoverMenu({
  placement = 'top',
  offset: offsetValue = 8,
  delay = { open: 100, close: 150 },
  disabled = false,
  scrollParent = null,
  boundary = null
}: HoverMenuOptions = {}) {
  const [open, setOpen] = useState(false)
  const [openDropdownCount, setOpenDropdownCount] = useState(0)
  const [scrollLocked, setScrollLocked] = useState(false)
  const [isInViewport, setIsInViewport] = useState(true)
  const menuId = useRef(`hover-menu-${Math.random().toString(36).substr(2, 9)}`)

  const incrementDropdownCount = useCallback(() => {
    setOpenDropdownCount((prev) => prev + 1)
  }, [])

  const decrementDropdownCount = useCallback(() => {
    setOpenDropdownCount((prev) => Math.max(0, prev - 1))
  }, [])

  // Register with global manager
  useEffect(() => {
    const id = menuId.current
    hoverMenuManager.register(id, () => setOpen(false))

    return () => {
      hoverMenuManager.unregister(id)
    }
  }, [])

  // Close menu on scroll and temporarily lock interactions
  useEffect(() => {
    const targets = resolveScrollTargets(scrollParent)
    const fallbackTargets: Array<Element | Window | Document> = targets.length
      ? targets
      : [window, document]

    const releaseScrollLock = debounce(() => {
      setScrollLocked(false)
    }, 150)

    const handleScroll = () => {
      setScrollLocked(true)
      hoverMenuManager.close(menuId.current)
      setOpen(false)
      releaseScrollLock()
    }

    fallbackTargets.forEach((target) => {
      target.addEventListener('scroll', handleScroll, { passive: true })
    })

    return () => {
      releaseScrollLock.cancel()
      fallbackTargets.forEach((target) => {
        target.removeEventListener('scroll', handleScroll)
      })
    }
  }, [scrollParent])

  // Resolve boundary at render-time. The boundary element may mount AFTER
  // this hook (e.g., chatroom panel wrapper). Re-evaluating on each render
  // means the first hover may not have a boundary (falls back to
  // 'clippingAncestors'), the next render after panel mount picks it up,
  // and autoUpdate refreshes the position. Cost: one querySelector per
  // render — negligible.
  const resolvedBoundary = typeof boundary === 'function' ? boundary() : (boundary ?? null)

  const data = useFloating({
    placement,
    open: open && !disabled && !scrollLocked && isInViewport,
    onOpenChange: (newOpen) => {
      // Don't open if element is outside viewport
      if (newOpen && !isInViewport) return

      // Don't close if any dropdown is open
      if (!newOpen && openDropdownCount > 0) {
        return
      }

      if (newOpen) {
        // Tell manager this menu is opening
        hoverMenuManager.open(menuId.current)
      } else {
        // Tell manager this menu is closing
        hoverMenuManager.close(menuId.current)
      }

      setOpen(newOpen)
    },
    whileElementsMounted: autoUpdate,
    // left/top positioning — the overlay transition animates `transform: scale()`.
    transform: false,
    middleware: [
      offset(offsetValue),
      flip({
        crossAxis: false, // Prevent left-right flipping for consistent positioning
        fallbackAxisSideDirection: 'end',
        // Bumped from 5 to 10: with a tight padding, flip only fires when
        // the menu extends >5px past the boundary. 10px makes flip more
        // eager once the boundary is narrow (e.g., `.message-feed` only).
        padding: 10,
        ...(resolvedBoundary && { boundary: resolvedBoundary })
      }),
      shift({
        padding: 10,
        ...(resolvedBoundary && { boundary: resolvedBoundary })
      })
    ]
  })

  const context = data.context

  const hover = useHover(context, {
    move: false,
    enabled: !disabled && !scrollLocked && isInViewport,
    delay,
    handleClose: safePolygon({
      // 8px transit corridor — 1px required pixel-precise mouse movement
      // from reference into the floating menu and made users feel they
      // had to "exact-focus" each row.
      buffer: 8
    })
  })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })

  const interactions = useInteractions([hover, dismiss, role])

  // Track `open` via ref so the IntersectionObserver effect below doesn't
  // re-create the observer every open/close.
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  // Track reference visibility against the scroll container via
  // IntersectionObserver, NOT getBoundingClientRect-on-scroll. The manual
  // rect check captured stale values at mount time before Virtuoso had
  // measured items (initial channel open) and didn't refire on
  // layout-only changes after mount (bookmark indicator / reactions
  // rendering on bookmarked rows). Both bugs collapsed `isInViewport` to
  // `false`, which gated `useHover.enabled`, which silently disabled the
  // menu until the user scrolled and the manual check ran again.
  // IntersectionObserver fires on the initial measurement *and* on every
  // subsequent layout change that affects intersection, so both cases
  // are handled by construction.
  useEffect(() => {
    const targets = resolveScrollTargets(scrollParent)
    if (!targets.length) {
      setIsInViewport(true)
      return
    }
    const scrollContainer = targets[0]
    const referenceEl = data.refs.reference.current
    if (!(referenceEl instanceof Element) || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true)
      return
    }
    // Use `threshold: [0, 0.5, 1]` (not just `0.5`) so the observer fires
    // on the initial paint regardless of the starting intersection ratio.
    // With a single threshold the observer only fires when the ratio
    // *crosses* it — so a message that mounts already 80% visible may
    // never trigger a callback until the user scrolls.
    const root = scrollContainer instanceof Element ? scrollContainer : null
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (!entry) return
        const isVisible = entry.intersectionRatio >= 0.5
        setIsInViewport(isVisible)
        if (!isVisible && openRef.current) setOpen(false)
      },
      { root, threshold: [0, 0.5, 1] }
    )
    observer.observe(referenceEl)
    return () => observer.disconnect()
  }, [scrollParent, data.refs.reference])

  return useMemo(
    () => ({
      open: open && !disabled && !scrollLocked && isInViewport,
      setOpen,
      openDropdownCount,
      incrementDropdownCount,
      decrementDropdownCount,
      ...interactions,
      ...data
    }),
    [
      open,
      setOpen,
      openDropdownCount,
      incrementDropdownCount,
      decrementDropdownCount,
      interactions,
      data,
      disabled,
      scrollLocked,
      isInViewport
    ]
  )
}

export interface HoverMenuProps extends HoverMenuOptions {
  children: ReactNode
  menu: ReactNode
  className?: string
  /** Extra classes merged onto the floating menu element. Use to override
   *  z-index when portaling into a child stacking context. */
  menuClassName?: string
  id?: string
}

export function HoverMenu({
  children,
  menu,
  className,
  menuClassName,
  id,
  ...options
}: HoverMenuProps) {
  const hoverMenu = useHoverMenu(options)

  return (
    <HoverMenuContext.Provider value={hoverMenu}>
      <div
        id={id}
        ref={hoverMenu.refs.setReference}
        {...hoverMenu.getReferenceProps()}
        className={twMerge('inline-block', className)}>
        {children}
        {hoverMenu.open && (
          <HoverMenuContent portalId={options.portalId} menuClassName={menuClassName}>
            {menu}
          </HoverMenuContent>
        )}
      </div>
    </HoverMenuContext.Provider>
  )
}

interface HoverMenuContentProps {
  children: ReactNode
  portalId?: string
  menuClassName?: string
}

const HoverMenuContent: FC<HoverMenuContentProps> = ({ children, portalId, menuClassName }) => {
  const context = useHoverMenuContext()
  const { isMounted, styles: transitionStyles } = useOverlayTransition(context.context)

  if (!isMounted) return null

  return (
    <FloatingPortal id={portalId}>
      <div
        ref={context.refs.setFloating}
        style={{
          ...context.floatingStyles,
          ...transitionStyles,
          position: 'fixed',
          maxWidth: '100%'
        }}
        {...context.getFloatingProps()}
        className={twMerge(
          'join border-base-300 bg-base-200 z-50 flex flex-row rounded-lg border shadow-md',
          menuClassName
        )}>
        {children}
      </div>
    </FloatingPortal>
  )
}

export interface HoverMenuItemProps {
  children: ReactNode
  tooltip?: string
  className?: string
}

export const HoverMenuItem: FC<HoverMenuItemProps> = ({ children, tooltip, className }) => {
  const item = (
    <div className={twMerge('btn btn-sm btn-square join-item btn-ghost', className)}>
      {children}
    </div>
  )

  if (!tooltip) return item

  return (
    <Tooltip title={tooltip} placement="left">
      {item}
    </Tooltip>
  )
}

// Floating UI Dropdown Hook
function useFloatingDropdown() {
  const [open, setOpen] = useState(false)

  const data = useFloating({
    placement: 'bottom-end',
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    // left/top positioning — the overlay transition animates `transform: scale()`.
    transform: false,
    middleware: [
      offset(4),
      flip({
        fallbackPlacements: ['top-end', 'bottom-start', 'top-start'],
        padding: 8
      }),
      shift({ padding: 8 })
    ]
  })

  const context = data.context
  const { isMounted, styles: transitionStyles } = useOverlayTransition(context)

  const click = useClick(context)
  const dismiss = useDismiss(context)
  const role = useRole(context)

  const interactions = useInteractions([click, dismiss, role])

  return useMemo(
    () => ({
      open,
      setOpen,
      isMounted,
      transitionStyles,
      ...interactions,
      ...data
    }),
    [open, setOpen, isMounted, transitionStyles, interactions, data]
  )
}

// Dropdown Context for children to access dropdown state
interface DropdownContextType {
  isOpen: boolean
  setOpen: (open: boolean) => void
  closeDropdown: () => void
}

const DropdownContext = createContext<DropdownContextType | null>(null)

export const useDropdownContext = () => {
  const context = useContext(DropdownContext)
  if (!context) {
    throw new Error('Dropdown context must be used within HoverMenuDropdown')
  }
  return context
}

// HoverMenuDropdown - Wrapper that provides dropdown context
export interface HoverMenuDropdownProps {
  children: ReactNode
  trigger: ReactNode
  tooltip?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
}

export const HoverMenuDropdown: FC<HoverMenuDropdownProps> = ({
  children,
  trigger,
  tooltip,
  disabled,
  className,
  contentClassName
}) => {
  const dropdown = useFloatingDropdown()
  const hoverMenuContext = useHoverMenuContext()

  // Track dropdown state in parent context
  useEffect(() => {
    if (dropdown.open) {
      hoverMenuContext.incrementDropdownCount()
      return () => hoverMenuContext.decrementDropdownCount()
    }
  }, [dropdown.open, hoverMenuContext])

  // Create context value
  const dropdownContextValue = useMemo(
    () => ({
      isOpen: dropdown.open,
      setOpen: dropdown.setOpen,
      closeDropdown: () => dropdown.setOpen(false)
    }),
    [dropdown]
  )

  return (
    <DropdownContext.Provider value={dropdownContextValue}>
      {/* Trigger Button — span wrapper isolates Tooltip ref from dropdown ref */}
      <Tooltip title={tooltip} placement="left" open={dropdown.open ? false : undefined}>
        <span className={twMerge('join-item inline-flex', className)}>
          <Button
            ref={dropdown.refs.setReference}
            {...dropdown.getReferenceProps()}
            variant="ghost"
            size="sm"
            shape="square"
            disabled={disabled}>
            {trigger}
          </Button>
        </span>
      </Tooltip>

      {/* Dropdown Content */}
      {dropdown.isMounted && (
        <FloatingPortal>
          <div
            ref={dropdown.refs.setFloating}
            style={{
              ...dropdown.floatingStyles,
              ...dropdown.transitionStyles,
              position: 'fixed',
              maxWidth: '100%',
              maxHeight: '100%',
              overflow: 'hidden'
            }}
            {...dropdown.getFloatingProps()}
            className={twMerge(
              'bg-base-100 rounded-box border-base-300 z-[60] overflow-hidden border shadow-md',
              contentClassName
            )}>
            <ul className="menu bg-base-100 rounded-box max-h-80 w-52 overflow-y-auto !p-1">
              {children}
            </ul>
          </div>
        </FloatingPortal>
      )}
    </DropdownContext.Provider>
  )
}

// Helper component for dropdown items that need to close the dropdown on click
export interface HoverMenuDropdownItemProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const HoverMenuDropdownItem: FC<HoverMenuDropdownItemProps> = ({
  children,
  onClick,
  disabled,
  className
}) => {
  const { closeDropdown } = useDropdownContext()

  const handleClick = () => {
    onClick?.()
    closeDropdown()
  }

  return (
    <li>
      <Button
        variant="ghost"
        onClick={handleClick}
        disabled={disabled}
        className={twMerge('flex w-full items-center gap-2 text-sm', className)}>
        {children}
      </Button>
    </li>
  )
}
