import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useContext,
  createContext,
  type FC,
  type ReactNode,
  type CSSProperties
} from 'react'
import debounce from 'lodash/debounce'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useDismiss,
  useRole,
  useInteractions,
  Placement,
  FloatingPortal,
  safePolygon,
  useClick
} from '@floating-ui/react'
import { twMerge } from 'tailwind-merge'

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

interface HoverMenuOptions {
  placement?: Placement
  offset?: number
  delay?: number | { open?: number; close?: number }
  disabled?: boolean
  scrollParent?: Element | Window | ScrollParentResolver | null
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
  delay = { open: 200, close: 150 },
  disabled = false,
  scrollParent = null
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
    middleware: [
      offset(offsetValue),
      flip({
        crossAxis: false, // Prevent left-right flipping for consistent positioning
        fallbackAxisSideDirection: 'end',
        padding: 5
      }),
      shift({ padding: 5 })
    ]
  })

  const context = data.context

  const hover = useHover(context, {
    move: false,
    enabled: !disabled && !scrollLocked && isInViewport,
    delay,
    handleClose: safePolygon({
      buffer: 1
    })
  })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })

  const interactions = useInteractions([hover, dismiss, role])

  // Check if reference element is within viewport of scrollParent
  useEffect(() => {
    const targets = resolveScrollTargets(scrollParent)
    if (!targets.length) {
      setIsInViewport(true)
      return
    }

    const scrollContainer = targets[0]

    const checkVisibility = () => {
      const referenceEl = data.refs.reference.current
      if (!referenceEl || !(scrollContainer instanceof Element)) {
        setIsInViewport(true)
        return
      }

      const containerRect = scrollContainer.getBoundingClientRect()
      const elementRect = referenceEl.getBoundingClientRect()

      // Calculate visible area
      const visibleTop = Math.max(elementRect.top, containerRect.top)
      const visibleBottom = Math.min(elementRect.bottom, containerRect.bottom)
      const visibleLeft = Math.max(elementRect.left, containerRect.left)
      const visibleRight = Math.min(elementRect.right, containerRect.right)

      const visibleHeight = Math.max(0, visibleBottom - visibleTop)
      const visibleWidth = Math.max(0, visibleRight - visibleLeft)
      const visibleArea = visibleHeight * visibleWidth

      const totalHeight = elementRect.bottom - elementRect.top
      const totalWidth = elementRect.right - elementRect.left
      const totalArea = totalHeight * totalWidth

      // Require at least 50% of the element to be visible
      const visibilityThreshold = 0.5
      const isVisible = totalArea > 0 && visibleArea / totalArea >= visibilityThreshold

      setIsInViewport(isVisible)

      if (!isVisible && open) setOpen(false)
    }

    // Check initially
    checkVisibility()

    // Check on scroll
    scrollContainer.addEventListener('scroll', checkVisibility, { passive: true })
    window.addEventListener('resize', checkVisibility, { passive: true })

    return () => {
      scrollContainer.removeEventListener('scroll', checkVisibility)
      window.removeEventListener('resize', checkVisibility)
    }
  }, [scrollParent, data.refs.reference, open])

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
  id?: string
}

export function HoverMenu({ children, menu, className, id, ...options }: HoverMenuProps) {
  const hoverMenu = useHoverMenu(options)

  return (
    <HoverMenuContext.Provider value={hoverMenu}>
      <div
        id={id}
        ref={hoverMenu.refs.setReference}
        {...hoverMenu.getReferenceProps()}
        className={twMerge('inline-block', className)}>
        {children}
        {hoverMenu.open && <HoverMenuContent>{menu}</HoverMenuContent>}
      </div>
    </HoverMenuContext.Provider>
  )
}

interface HoverMenuContentProps {
  children: ReactNode
}

const HoverMenuContent: FC<HoverMenuContentProps> = ({ children }) => {
  const context = useHoverMenuContext()

  if (!context.open) return null

  return (
    <FloatingPortal>
      <div
        ref={context.refs.setFloating}
        style={{
          ...context.floatingStyles,
          position: 'fixed',
          maxWidth: '100%'
        }}
        {...context.getFloatingProps()}
        className="join bg-base-300 z-50 flex flex-row rounded-md shadow-xs">
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
  return (
    <div
      className={twMerge(
        'btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left',
        className
      )}
      data-tip={tooltip}>
      {children}
    </div>
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

  const click = useClick(context)
  const dismiss = useDismiss(context)
  const role = useRole(context)

  const interactions = useInteractions([click, dismiss, role])

  return useMemo(
    () => ({
      open,
      setOpen,
      ...interactions,
      ...data
    }),
    [open, setOpen, interactions, data]
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
      {/* Trigger Button */}
      <button
        ref={dropdown.refs.setReference}
        {...dropdown.getReferenceProps()}
        className={twMerge(
          'btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left',
          className
        )}
        data-tip={tooltip}
        disabled={disabled}>
        {trigger}
      </button>

      {/* Dropdown Content */}
      {dropdown.open && (
        <FloatingPortal>
          <div
            ref={dropdown.refs.setFloating}
            style={{
              ...dropdown.floatingStyles,
              position: 'fixed',
              maxWidth: '100%',
              maxHeight: '100%',
              overflow: 'hidden'
            }}
            {...dropdown.getFloatingProps()}
            className={twMerge(
              'bg-base-100 rounded-box z-[60] overflow-hidden border border-gray-300 shadow-md',
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
      <button
        onClick={handleClick}
        disabled={disabled}
        className={twMerge('flex w-full items-center gap-2 text-sm', className)}>
        {children}
      </button>
    </li>
  )
}
