import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext
} from 'react'
import {
  useFloating,
  autoUpdate,
  flip,
  offset,
  shift,
  useRole,
  useDismiss,
  useInteractions,
  useListNavigation,
  useTypeahead,
  FloatingPortal,
  FloatingFocusManager,
  FloatingOverlay
} from '@floating-ui/react'

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

export const MenuItem = forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  ({ children, ...props }, ref) => {
    return <li {...props}>{children}</li>
  }
)

MenuItem.displayName = 'MenuItem'

interface Props {
  label?: string
  nested?: boolean
  parrentRef?: any
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
      parrentRef,
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
    const listItemsRef = useRef<Array<HTMLUListElement | null>>([])
    const listContentRef = useRef(
      Children.map(children, (child) =>
        // @ts-ignore
        isValidElement(child) ? child.props.label : null
      ) as Array<string | null>
    )
    const allowMouseUpCloseRef = useRef(false)

    const { refs, floatingStyles, context } = useFloating({
      open: isOpen,
      onOpenChange: setIsOpen,
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
        let targetElement = null
        if (onBeforeShow) {
          targetElement = onBeforeShow(e, e.target)
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
          if (onClose) {
            onClose()
          }
        }
      }

      parrentRef?.current?.addEventListener('contextmenu', onContextMenu)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        parrentRef?.current?.removeEventListener('contextmenu', onContextMenu)
        document.removeEventListener('mouseup', onMouseUp)
        clearTimeout(timeout)
      }
    }, [refs, parrentRef, externalIsOpen, setIsOpen, onBeforeShow, onOpenChange])

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

    // useEffect(() => {
    //   console.log('isOpen', { isOpen })
    // }, [isOpen])

    // If using external control and no parrentRef, we can still render
    // This check is moved after all hooks to comply with Rules of Hooks
    if (!parrentRef?.current && externalIsOpen === undefined) return null

    if (!isOpen) return null

    return (
      <ContextMenuContext.Provider value={{ setIsOpen, isOpen, mouseEvent }}>
        <FloatingPortal>
          <FloatingOverlay lockScroll>
            <FloatingFocusManager context={context} initialFocus={refs.floating}>
              <ul
                className={className}
                ref={refs.setFloating || ref}
                style={floatingStyles}
                {...getFloatingProps()}>
                {Children.map(children, (child, index) => {
                  if (isValidElement(child)) {
                    return cloneElement(
                      child,
                      getItemProps({
                        tabIndex: activeIndex === index ? 0 : -1,
                        ref(node: HTMLUListElement) {
                          listItemsRef.current[index] = node
                        },
                        onClick(e) {
                          // Stop propagation to prevent conflicts with document mouseup
                          e.stopPropagation()
                          e.preventDefault()

                          // Execute the menu item action
                          // @ts-ignore
                          child.props.onClick?.(e, mouseEvent)

                          // Close menu - handle both internal and external control
                          if (externalIsOpen !== undefined && onOpenChange) {
                            // External control - call the parent's close handler
                            onOpenChange(false)
                          } else {
                            // Internal control - use internal state
                            setIsOpen(false)
                          }

                          // Call cleanup callback
                          if (onClose) {
                            onClose()
                          }
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
