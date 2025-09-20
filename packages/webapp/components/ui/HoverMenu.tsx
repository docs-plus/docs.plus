import * as React from 'react'
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
  floatingStyles: React.CSSProperties
  context: ReturnType<typeof useFloating>['context']
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps']
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps']
  openDropdownCount: number
  incrementDropdownCount: () => void
  decrementDropdownCount: () => void
}

const HoverMenuContext = React.createContext<HoverMenuContextType | null>(null)

export const useHoverMenuContext = () => {
  const context = React.useContext(HoverMenuContext)
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
  const [open, setOpen] = React.useState(false)
  const [openDropdownCount, setOpenDropdownCount] = React.useState(0)
  const [scrollLocked, setScrollLocked] = React.useState(false)
  const menuId = React.useRef(`hover-menu-${Math.random().toString(36).substr(2, 9)}`)

  const incrementDropdownCount = React.useCallback(() => {
    setOpenDropdownCount((prev) => prev + 1)
  }, [])

  const decrementDropdownCount = React.useCallback(() => {
    setOpenDropdownCount((prev) => Math.max(0, prev - 1))
  }, [])

  // Register with global manager
  React.useEffect(() => {
    const id = menuId.current
    hoverMenuManager.register(id, () => setOpen(false))

    return () => {
      hoverMenuManager.unregister(id)
    }
  }, [])

  // Close menu on scroll and temporarily lock interactions
  React.useEffect(() => {
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
    open: open && !disabled && !scrollLocked,
    onOpenChange: (newOpen) => {
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
    enabled: !disabled && !scrollLocked,
    delay,
    handleClose: safePolygon({
      buffer: 1
    })
  })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })

  const interactions = useInteractions([hover, dismiss, role])

  return React.useMemo(
    () => ({
      open: open && !disabled && !scrollLocked,
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
      scrollLocked
    ]
  )
}

export interface HoverMenuProps extends HoverMenuOptions {
  children: React.ReactNode
  menu: React.ReactNode
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
  children: React.ReactNode
}

const HoverMenuContent: React.FC<HoverMenuContentProps> = ({ children }) => {
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
  children: React.ReactNode
  tooltip?: string
  className?: string
}

export const HoverMenuItem: React.FC<HoverMenuItemProps> = ({ children, tooltip, className }) => {
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
  const [open, setOpen] = React.useState(false)

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

  return React.useMemo(
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

const DropdownContext = React.createContext<DropdownContextType | null>(null)

export const useDropdownContext = () => {
  const context = React.useContext(DropdownContext)
  if (!context) {
    throw new Error('Dropdown context must be used within HoverMenuDropdown')
  }
  return context
}

// HoverMenuDropdown - Wrapper that provides dropdown context
export interface HoverMenuDropdownProps {
  children: React.ReactNode
  trigger: React.ReactNode
  tooltip?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
}

export const HoverMenuDropdown: React.FC<HoverMenuDropdownProps> = ({
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
  React.useEffect(() => {
    if (dropdown.open) {
      hoverMenuContext.incrementDropdownCount()
      return () => hoverMenuContext.decrementDropdownCount()
    }
  }, [dropdown.open, hoverMenuContext])

  // Create context value
  const dropdownContextValue = React.useMemo(
    () => ({
      isOpen: dropdown.open,
      setOpen: dropdown.setOpen,
      closeDropdown: () => dropdown.setOpen(false)
    }),
    [dropdown.open, dropdown.setOpen]
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
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const HoverMenuDropdownItem: React.FC<HoverMenuDropdownItemProps> = ({
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
