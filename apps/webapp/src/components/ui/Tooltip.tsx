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
  useHover,
  useInteractions,
  useMergeRefs,
  useRole
} from '@floating-ui/react'
import { cloneElement, isValidElement, ReactNode, useRef, useState } from 'react'

/** Touch-only devices have no hover — tooltips are irrelevant */
const canHover = typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : true

interface TooltipProps {
  /** Tooltip content */
  title: ReactNode
  /** Trigger element — must accept ref */
  children: ReactNode
  /** Floating UI placement */
  placement?: Placement
  /** Delay before showing (ms) */
  showDelay?: number
  /** Delay before hiding (ms) */
  hideDelay?: number
  /** Extra class on the tooltip bubble */
  className?: string
  /** Controlled open state (pass `false` to force-close, `undefined` for uncontrolled) */
  open?: boolean
  /** Callback for controlled open changes */
  onOpenChange?: (open: boolean) => void
}

export function Tooltip({
  title,
  children,
  placement = 'top',
  showDelay = 200,
  hideDelay = 0,
  className = '',
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const arrowRef = useRef<HTMLDivElement>(null)

  const isOpen = controlledOpen ?? uncontrolledOpen

  const {
    refs,
    floatingStyles,
    context,
    middlewareData,
    placement: finalPlacement
  } = useFloating({
    placement,
    strategy: 'fixed',
    open: isOpen,
    onOpenChange: (open) => {
      setControlledOpen?.(open)
      setUncontrolledOpen(open)
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

  const hover = useHover(context, {
    enabled: canHover && controlledOpen == null,
    delay: { open: showDelay, close: hideDelay },
    move: false
  })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role])

  // React 19: ref is a regular prop in element.props — read from both locations
  const childRef = isValidElement(children)
    ? ((children as any).props?.ref ?? (children as any).ref ?? null)
    : null
  const mergedRef = useMergeRefs([refs.setReference, childRef])

  // Touch-only devices — render children without tooltip overhead (after all hooks)
  if (!canHover) return <>{children}</>

  // Strip `ref` from child props so it doesn't overwrite our merged ref (React 19 compat)
  const { ref: _childRef, ...childPropsWithoutRef } = isValidElement(children)
    ? ((children as React.ReactElement<any>).props ?? {})
    : ({} as Record<string, unknown>)

  // Attach interaction props + merged ref to the child element
  const trigger = isValidElement(children)
    ? cloneElement(
        children as React.ReactElement<any>,
        getReferenceProps({
          ...childPropsWithoutRef,
          ref: mergedRef // Must come LAST to take precedence
        })
      )
    : children

  // Arrow geometry
  const side = finalPlacement.split('-')[0] as 'top' | 'right' | 'bottom' | 'left'
  const staticSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[side]

  const arrowStyle: React.CSSProperties = {
    left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : '',
    top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : '',
    [staticSide]: '-2px'
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
            className={`bg-neutral text-neutral-content z-50 rounded px-2 py-1 font-mono text-xs ${className}`}
            {...getFloatingProps()}>
            {title}
            <div
              ref={arrowRef}
              style={arrowStyle}
              className={`bg-neutral absolute h-2 w-2 ${arrowRotation}`}
            />
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
