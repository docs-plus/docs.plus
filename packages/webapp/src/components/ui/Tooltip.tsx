import {
  arrow,
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  Placement,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole} from '@floating-ui/react'
import { cloneElement, isValidElement, ReactNode,useEffect, useRef, useState } from 'react'

interface TooltipProps {
  title: ReactNode
  children: ReactNode
  placement?: Placement
  showDelay?: number
  hideDelay?: number
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideOnFocus?: boolean
}

export function Tooltip({
  title,
  children,
  placement = 'top',
  showDelay = 200,
  hideDelay = 0,
  className = '',
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  hideOnFocus = true
}: TooltipProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const arrowRef = useRef<HTMLDivElement>(null)

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  // Calculate if tooltip should be open
  const shouldShowTooltip = hideOnFocus ? isHovering && !isFocused : isHovering
  const isOpen = controlledOpen ?? shouldShowTooltip

  const {
    refs,
    floatingStyles,
    context,
    middlewareData,
    placement: finalPlacement
  } = useFloating({
    placement,
    open: isOpen,
    onOpenChange: (open) => {
      if (setControlledOpen) {
        setControlledOpen(open)
      }
    },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({
        crossAxis: placement.includes('-'),
        fallbackAxisSideDirection: 'start',
        padding: 4
      }),
      shift({ padding: 4 }),
      arrow({ element: arrowRef })
    ]
  })

  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role])

  const handleMouseEnter = () => {
    if (controlledOpen != null) return // Skip if controlled

    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true)
    }, showDelay)
  }

  const handleMouseLeave = () => {
    if (controlledOpen != null) return // Skip if controlled

    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

    if (hideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsHovering(false)
      }, hideDelay)
    } else {
      setIsHovering(false)
    }
  }

  const handleFocus = () => {
    if (controlledOpen != null) return // Skip if controlled
    if (hideOnFocus) setIsFocused(true)
  }

  const handleBlur = () => {
    if (controlledOpen != null) return // Skip if controlled
    if (hideOnFocus) setIsFocused(false)
  }

  // Clone child element and attach ref + props, merging with existing props
  const childProps = isValidElement(children) ? (children as React.ReactElement<any>).props : {}

  const trigger = isValidElement(children)
    ? cloneElement(
        children as React.ReactElement<any>,
        getReferenceProps({
          ref: refs.setReference,
          ...childProps,
          onMouseEnter: (e: React.MouseEvent) => {
            handleMouseEnter()
            childProps.onMouseEnter?.(e)
          },
          onMouseLeave: (e: React.MouseEvent) => {
            handleMouseLeave()
            childProps.onMouseLeave?.(e)
          },
          onFocus: (e: React.FocusEvent) => {
            handleFocus()
            childProps.onFocus?.(e)
          },
          onBlur: (e: React.FocusEvent) => {
            handleBlur()
            childProps.onBlur?.(e)
          }
        })
      )
    : children

  const arrowX = middlewareData.arrow?.x
  const arrowY = middlewareData.arrow?.y
  const side = finalPlacement.split('-')[0] as 'top' | 'right' | 'bottom' | 'left'

  // Arrow should be on opposite side of tooltip and point toward element
  const oppositeSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right'
  }[side]

  const arrowStyles: React.CSSProperties = {
    left: arrowX != null ? `${arrowX}px` : '',
    top: arrowY != null ? `${arrowY}px` : '',
    [oppositeSide]: '-2px'
  }

  const arrowRotation = {
    top: 'rotate-[225deg]',
    right: 'rotate-[315deg]',
    bottom: 'rotate-45',
    left: 'rotate-[135deg]'
  }[side]

  return (
    <>
      {trigger}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={`monospace z-50 rounded bg-gray-900 p-1 px-2 text-xs text-white ${className}`}
            {...getFloatingProps()}>
            {title}
            <div
              ref={arrowRef}
              style={arrowStyles}
              className={`absolute h-2 w-2 bg-gray-900 ${arrowRotation}`}
            />
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
