import { useState, cloneElement, isValidElement, ReactNode } from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  Placement
} from '@floating-ui/react'

interface TooltipProps {
  title: ReactNode
  children: ReactNode
  placement?: Placement
  showDelay?: number
  hideDelay?: number
  className?: string
}

export function Tooltip({
  title,
  children,
  placement = 'top',
  showDelay = 200,
  hideDelay = 0,
  className = ''
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  const { refs, floatingStyles, context } = useFloating({
    placement,
    open: isOpen,
    onOpenChange: setIsOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({
        crossAxis: placement.includes('-'),
        fallbackAxisSideDirection: 'start',
        padding: 8
      }),
      shift({ padding: 8 })
    ]
  })

  const hover = useHover(context, {
    move: false,
    delay: { open: showDelay, close: hideDelay }
  })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])

  // Clone child element and attach ref + props
  const trigger = isValidElement(children)
    ? cloneElement(
        children as React.ReactElement<any>,
        getReferenceProps({ ref: refs.setReference })
      )
    : children

  return (
    <>
      {trigger}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={`z-50 rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white shadow-lg ${className}`}
            {...getFloatingProps()}>
            {title}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
