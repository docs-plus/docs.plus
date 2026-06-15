import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  useTypeahead
} from '@floating-ui/react'
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
import { twMerge } from 'tailwind-merge'

import { useOverlayTransition } from './useOverlayTransition'

/** Shared shell for TOC + chatroom right-click menus — Tailwind flex column, not daisyUI `menu`. */
export const contextMenuPanelClassName =
  'flex flex-col list-none bg-base-100 border-base-300 m-0 min-w-[11rem] rounded-xl border p-1.5 shadow-xl outline-none'

export type ContextMenuRowVariant = 'default' | 'primary' | 'danger'

type ContextMenuRowProps = {
  icon: React.ReactNode
  children: React.ReactNode
  variant?: ContextMenuRowVariant
  className?: string
  dimIcon?: boolean
}

const contextMenuRowVariantClass: Record<ContextMenuRowVariant, string> = {
  default: 'group-hover:bg-base-300 group-active:bg-base-300/90',
  primary: 'group-hover:bg-base-300 group-active:bg-base-300/90 text-primary',
  danger: 'group-hover:bg-error/20 group-active:bg-error/25 text-error'
}

export function ContextMenuRow({
  icon,
  children,
  variant = 'default',
  className,
  dimIcon = true
}: ContextMenuRowProps) {
  return (
    <span
      className={twMerge(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150',
        contextMenuRowVariantClass[variant],
        className
      )}>
      <span className={twMerge('flex-shrink-0', dimIcon && variant === 'default' && 'opacity-70')}>
        {icon}
      </span>
      <span className="font-medium">{children}</span>
    </span>
  )
}

export function ContextMenuDivider({ className }: { className?: string }) {
  return (
    <li
      role="separator"
      aria-hidden
      className={twMerge('bg-base-300 pointer-events-none my-[4px] h-px shrink-0 p-0', className)}
    />
  )
}

interface ContextMenuContextType {
  setIsOpen: (open: boolean) => void
  isOpen: boolean
  mouseEvent: MouseEvent | null
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined)

export const useContextMenuContext = () => {
  const context = useContext(ContextMenuContext)
  if (!context) {
    throw new Error('useContextMenuContext must be used within ContextMenuContext.Provider')
  }
  return context
}

type MenuItemProps = React.LiHTMLAttributes<HTMLLIElement> & {
  ref?: React.Ref<HTMLLIElement>
}

export function MenuItem({ children, ref, className, ...props }: MenuItemProps) {
  return (
    <li ref={ref} className={twMerge('group cursor-pointer rounded-lg', className)} {...props}>
      {children}
    </li>
  )
}

type ContextMenuChildProps = {
  label?: string
  onClick?: (e: React.MouseEvent, mouseEvent: MouseEvent | null) => void
}

interface Props {
  label?: string
  nested?: boolean
  parentRef?: React.RefObject<HTMLElement | null>
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  mousePosition?: { x: number; y: number } | null
  onBeforeShow?: (e: MouseEvent, target: EventTarget | null) => Element | null
  onClose?: () => void
}

export const ContextMenu = forwardRef<HTMLUListElement, Props & React.HTMLProps<HTMLUListElement>>(
  (
    {
      children,
      parentRef,
      className,
      isOpen: externalIsOpen,
      onOpenChange,
      mousePosition,
      onBeforeShow,
      onClose
    },
    ref
  ) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    const [internalIsOpen, setInternalIsOpen] = useState(false)
    const [mouseEvent, setMouseEvent] = useState<MouseEvent | null>(null)

    // Use external control if provided, otherwise use internal state
    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
    const setIsOpen = onOpenChange || setInternalIsOpen

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const listItemsRef = useRef<Array<HTMLLIElement | null>>([])
    const listContentRef = useRef<Array<string | null>>(
      Children.map(children, (child) =>
        isValidElement<ContextMenuChildProps>(child) ? (child.props.label ?? null) : null
      ) ?? []
    )
    const allowMouseUpCloseRef = useRef(false)

    const { refs, floatingStyles, context } = useFloating({
      open: isOpen,
      onOpenChange: setIsOpen,
      // left/top positioning — the overlay transition animates `transform: scale()`.
      transform: false,
      middleware: [
        offset({ mainAxis: 5, alignmentAxis: 4 }),
        flip({
          fallbackPlacements: ['left-start']
        }),
        shift({ padding: 10 })
      ],
      placement: 'right-start',
      strategy: 'fixed',
      whileElementsMounted: autoUpdate
    })

    // Menu tier: 120ms scale-in from the cursor side, instant dismissal.
    const { isMounted, styles: transitionStyles } = useOverlayTransition(context, { closeMs: 0 })

    // Set position reference when mousePosition is provided externally
    useEffect(() => {
      if (mousePosition && externalIsOpen) {
        refs.setPositionReference({
          getBoundingClientRect() {
            return {
              width: 0,
              height: 0,
              x: mousePosition.x,
              y: mousePosition.y,
              top: mousePosition.y,
              right: mousePosition.x,
              bottom: mousePosition.y,
              left: mousePosition.x
            }
          }
        })
      }
    }, [mousePosition, externalIsOpen, refs])

    const role = useRole(context, { role: 'menu' })
    const dismiss = useDismiss(context)
    const listNavigation = useListNavigation(context, {
      listRef: listItemsRef,
      onNavigate: setActiveIndex,
      activeIndex
    })
    const typeahead = useTypeahead(context, {
      enabled: isOpen,
      listRef: listContentRef,
      onMatch: setActiveIndex,
      activeIndex
    })

    const { getFloatingProps, getItemProps } = useInteractions([
      role,
      dismiss,
      listNavigation,
      typeahead
    ])

    // Only set up automatic event listeners if not using external control
    useEffect(() => {
      if (externalIsOpen !== undefined) return // Skip if externally controlled

      let timeout: number

      function onContextMenu(e: MouseEvent) {
        e.preventDefault()

        // If onBeforeShow is provided, call it to get the target element
        if (onBeforeShow) {
          const targetElement = onBeforeShow(e, e.target)
          // If onBeforeShow returns null, don't show the context menu
          if (!targetElement) return
        }

        setMouseEvent(e)

        // Always position at mouse click location, regardless of target element
        // The target element is used for context/validation, not positioning
        refs.setPositionReference({
          getBoundingClientRect() {
            return {
              width: 0,
              height: 0,
              x: e.clientX,
              y: e.clientY,
              top: e.clientY,
              right: e.clientX,
              bottom: e.clientY,
              left: e.clientX
            }
          }
        })

        clearTimeout(timeout)
        setIsOpen(true)

        allowMouseUpCloseRef.current = false
        timeout = window.setTimeout(() => {
          allowMouseUpCloseRef.current = true
        }, 300)
      }

      function onMouseUp(e: MouseEvent) {
        // Check if mouseup happened inside the floating menu
        const menuElement = refs.floating?.current
        const isInsideMenu = menuElement && menuElement.contains(e.target as Node)

        // Don't close if mouseup is inside the menu (let click events handle it)
        if (isInsideMenu) return

        if (allowMouseUpCloseRef.current) {
          setIsOpen(false)
          // Clear message context when closing via onBeforeShow pattern
          if (onBeforeShow && onOpenChange) {
            onOpenChange(false)
          }
          // Call cleanup callback
          onClose?.()
        }
      }

      const parent = parentRef?.current
      parent?.addEventListener('contextmenu', onContextMenu)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        parent?.removeEventListener('contextmenu', onContextMenu)
        document.removeEventListener('mouseup', onMouseUp)
        clearTimeout(timeout)
      }
      // onClose is intentionally omitted to avoid re-binding the listener
      // every render when the parent doesn't memoize the callback.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refs, parentRef, externalIsOpen, setIsOpen, onBeforeShow, onOpenChange])

    // Handle mouse event from external control
    useEffect(() => {
      if (externalIsOpen && mousePosition) {
        // Create a synthetic mouse event for the context menu items
        const syntheticEvent = {
          clientX: mousePosition.x,
          clientY: mousePosition.y,
          preventDefault: () => {},
          target: null
        } as MouseEvent
        setMouseEvent(syntheticEvent)
      }
    }, [externalIsOpen, mousePosition])

    useEffect(() => {
      if (!isOpen && onClose) {
        onClose()
      }
      // onClose intentionally omitted; firing on identity change would
      // double-invoke the parent's handler on every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // If using external control and no parentRef, we can still render
    // This check is moved after all hooks to comply with Rules of Hooks
    if (!parentRef?.current && externalIsOpen === undefined) return null

    if (!isMounted) return null

    return (
      <ContextMenuContext.Provider value={{ setIsOpen, isOpen, mouseEvent }}>
        <FloatingPortal>
          <FloatingOverlay lockScroll>
            <FloatingFocusManager context={context} initialFocus={refs.floating}>
              <ul
                className={className}
                ref={refs.setFloating || ref}
                style={{ ...floatingStyles, ...transitionStyles }}
                {...getFloatingProps()}>
                {Children.map(children, (child, index) => {
                  if (isValidElement<ContextMenuChildProps>(child)) {
                    return cloneElement(
                      child,
                      getItemProps({
                        tabIndex: activeIndex === index ? 0 : -1,
                        ref(node: HTMLLIElement | null) {
                          listItemsRef.current[index] = node
                        },
                        onClick(e) {
                          // Stop propagation to prevent conflicts with document mouseup
                          e.stopPropagation()
                          e.preventDefault()

                          child.props.onClick?.(e, mouseEvent)

                          // Close menu - handle both internal and external control
                          if (externalIsOpen !== undefined && onOpenChange) {
                            // External control - call the parent's close handler
                            onOpenChange(false)
                          } else {
                            // Internal control - use internal state
                            setIsOpen(false)
                          }

                          onClose?.()
                        }
                      })
                    )
                  }
                  return child
                })}
              </ul>
            </FloatingFocusManager>
          </FloatingOverlay>
        </FloatingPortal>
      </ContextMenuContext.Provider>
    )
  }
)

ContextMenu.displayName = 'ContextMenu'
