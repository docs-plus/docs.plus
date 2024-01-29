import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useRef,
  useState
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

export const MenuItem = forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  ({ children, ...props }, ref) => {
    return (
      <li {...props} role="menuitem">
        {children}
      </li>
    )
  }
)

MenuItem.displayName = 'MenuItem'

interface Props {
  label?: string
  nested?: boolean
  parrentRef?: any
}

export const ContextMenu = forwardRef<HTMLUListElement, Props & React.HTMLProps<HTMLUListElement>>(
  ({ children, parrentRef, className }, forwardedRef) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const listItemsRef = useRef<Array<HTMLUListElement | null>>([])
    const listContentRef = useRef(
      Children.map(children, (child) =>
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

    useEffect(() => {
      let timeout: number

      function onContextMenu(e: MouseEvent) {
        e.preventDefault()

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

      function onMouseUp() {
        if (allowMouseUpCloseRef.current) {
          setIsOpen(false)
        }
      }

      parrentRef?.current.addEventListener('contextmenu', onContextMenu)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        parrentRef?.current?.removeEventListener('contextmenu', onContextMenu)
        document.removeEventListener('mouseup', onMouseUp)
        clearTimeout(timeout)
      }
    }, [refs, parrentRef])

    if (!isOpen) return

    return (
      <FloatingPortal>
        <FloatingOverlay lockScroll>
          <FloatingFocusManager context={context} initialFocus={refs.floating}>
            <ul
              className={className}
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}>
              {Children.map(
                children,
                (child, index) =>
                  isValidElement(child) &&
                  cloneElement(
                    child,
                    getItemProps({
                      tabIndex: activeIndex === index ? 0 : -1,
                      ref(node: HTMLUListElement) {
                        listItemsRef.current[index] = node
                      },
                      onClick() {
                        child.props.onClick?.()
                        setIsOpen(false)
                      },
                      onMouseUp() {
                        child.props.onClick?.()
                        setIsOpen(false)
                      }
                    })
                  )
              )}
            </ul>
          </FloatingFocusManager>
        </FloatingOverlay>
      </FloatingPortal>
    )
  }
)

ContextMenu.displayName = 'Menu'
