import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  Placement,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
  useRole
} from '@floating-ui/react'
import * as React from 'react'

import { useOverlayTransition } from './useOverlayTransition'

interface PopoverOptions {
  initialOpen?: boolean
  placement?: Placement
  modal?: boolean
  open?: boolean
  offset?: number
  onOpenChange?: (open: boolean) => void
}

export function usePopover({
  initialOpen = false,
  placement = 'bottom',
  modal,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  offset: offsetSize = 5
}: PopoverOptions = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(initialOpen)
  const [labelId, setLabelId] = React.useState<string | undefined>()
  const [descriptionId, setDescriptionId] = React.useState<string | undefined>()

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    // left/top positioning — the overlay transition animates `transform: scale()`.
    transform: false,
    middleware: [
      offset(offsetSize),
      flip({
        crossAxis: placement.includes('-'),
        fallbackAxisSideDirection: 'end',
        padding: offsetSize
      }),
      shift({ padding: offsetSize })
    ]
  })

  const context = data.context

  const click = useClick(context, {
    enabled: controlledOpen == null
  })
  const dismiss = useDismiss(context)
  const role = useRole(context)

  const interactions = useInteractions([click, dismiss, role])

  return React.useMemo(
    () => ({
      open,
      setOpen,
      ...interactions,
      ...data,
      modal,
      labelId,
      descriptionId,
      setLabelId,
      setDescriptionId
    }),
    [open, setOpen, interactions, data, modal, labelId, descriptionId]
  )
}

type ContextType =
  | (ReturnType<typeof usePopover> & {
      setLabelId: React.Dispatch<React.SetStateAction<string | undefined>>
      setDescriptionId: React.Dispatch<React.SetStateAction<string | undefined>>
    })
  | null

const PopoverContext = React.createContext<ContextType>(null)

/**
 * Elements a host keeps INSIDE the focus trap, so `FloatingFocusManager.markOthers()`
 * doesn't stamp `data-floating-ui-inert` on them. The pad editor region supplies its
 * ProseMirror root — that inert storm would otherwise make ProseMirror's DOMObserver
 * reconcile a wide range and recreate media node views (the embeds reload).
 */
const PopoverInsideElementsContext = React.createContext<(() => Element[]) | null>(null)
export const PopoverInsideElementsProvider = PopoverInsideElementsContext.Provider

export const usePopoverContext = () => {
  const context = React.useContext(PopoverContext)

  if (context == null) {
    throw new Error('Popover components must be wrapped in <Popover />')
  }

  return context
}

export const usePopoverState = () => {
  const context = React.useContext(PopoverContext)

  if (context == null) {
    return {
      isOpen: false,
      setOpen: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
      close: () => {}
    }
  }

  return {
    isOpen: context.open,
    setOpen: context.setOpen,
    close: () => context.setOpen(false)
  }
}

export function Popover({
  children,
  modal = false,
  ...restOptions
}: {
  children: React.ReactNode
} & PopoverOptions) {
  const popover = usePopover({ modal, ...restOptions })
  return <PopoverContext.Provider value={popover}>{children}</PopoverContext.Provider>
}

interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

export const PopoverTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLProps<HTMLElement> & PopoverTriggerProps
>(function PopoverTrigger({ children, asChild = false, ...props }, propRef) {
  const context = usePopoverContext()
  // React 19: ref is a regular prop — read from both locations
  const childrenRef = (children as any)?.props?.ref ?? (children as any)?.ref ?? null
  const ref = useMergeRefs([
    context.refs.setReference,
    propRef,
    childrenRef
  ]) as React.Ref<HTMLButtonElement>

  if (asChild && React.isValidElement(children)) {
    const { ref: _, ...childPropsWithoutRef } = (children as React.ReactElement<any>).props ?? {}
    return React.cloneElement(
      children,
      context.getReferenceProps({
        ...props,
        ...childPropsWithoutRef,
        ref,
        'data-state': context.open ? 'open' : 'closed'
      })
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      data-state={context.open ? 'open' : 'closed'}
      {...context.getReferenceProps(props)}>
      {children}
    </button>
  )
})

/**
 * Shared surface for anchored popover panels (toolbar + pad: media insert,
 * bookmarks, filter, settings, notifications). Unified with
 * `contextMenuPanelClassName` and `modalPanelChromeClassName` / `modalPanelClassName`
 * in Dialog.tsx: 1px base-300 border, rounded-xl corners, and shadow-xl elevation —
 * one floating-surface language across the app.
 */
export const popoverPanelClassName =
  'rounded-xl border-base-300 bg-base-100 z-50 w-[28rem] overflow-hidden border p-0 shadow-xl'

export const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  function PopoverContent({ style, ...props }, propRef) {
    const { context: floatingContext, ...context } = usePopoverContext()
    const ref = useMergeRefs([context.refs.setFloating, propRef]) as React.Ref<HTMLDivElement>
    const { isMounted, styles: transitionStyles } = useOverlayTransition(floatingContext)
    const getInsideElements = React.useContext(PopoverInsideElementsContext)

    if (!isMounted) return null

    return (
      <FloatingPortal>
        <FloatingFocusManager
          context={floatingContext}
          modal={context.modal}
          getInsideElements={getInsideElements ?? undefined}>
          <div
            ref={ref}
            style={{ ...context.floatingStyles, ...transitionStyles, ...style }}
            aria-labelledby={context.labelId}
            aria-describedby={context.descriptionId}
            {...context.getFloatingProps(props)}>
            {props.children}
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    )
  }
)

export const PopoverClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function PopoverClose(props, ref) {
  const { setOpen } = usePopoverContext()
  return (
    <button
      type="button"
      ref={ref}
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        setOpen(false)
      }}
    />
  )
})
