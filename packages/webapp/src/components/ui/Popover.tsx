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

interface PopoverOptions {
  initialOpen?: boolean
  placement?: Placement
  modal?: boolean
  open?: boolean
  offset?: number
  onOpenChange?: () => void
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

export const usePopoverContext = () => {
  const context = React.useContext(PopoverContext)

  if (context == null) {
    throw new Error('Popover components must be wrapped in <Popover />')
  }

  return context
}

export const usePopoverState = () => {
  const context = usePopoverContext()
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
  // This can accept any props as options, e.g. `placement`,
  // or other positioning options.
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
  const childrenRef = (children as any).ref
  const ref = useMergeRefs([
    context.refs.setReference,
    propRef,
    childrenRef
  ]) as React.Ref<HTMLButtonElement>

  // `asChild` allows the user to pass any element as the anchor
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children,
      context.getReferenceProps({
        ref,
        ...props,
        // @ts-ignore
        ...children.props,
        'data-state': context.open ? 'open' : 'closed'
      })
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      // The user can style the trigger based on the state
      data-state={context.open ? 'open' : 'closed'}
      {...context.getReferenceProps(props)}>
      {children}
    </button>
  )
})

export const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  function PopoverContent({ style, ...props }, propRef) {
    const { context: floatingContext, ...context } = usePopoverContext()
    const ref = useMergeRefs([context.refs.setFloating, propRef]) as React.Ref<HTMLDivElement>

    if (!floatingContext.open) return null

    return (
      <FloatingPortal>
        <FloatingFocusManager context={floatingContext} modal={context.modal}>
          <div
            ref={ref}
            style={{ ...context.floatingStyles, ...style }}
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
