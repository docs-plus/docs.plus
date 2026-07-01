import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
  useRole,
  useTransitionStyles
} from '@floating-ui/react'
import { MOTION_DIALOG_IN_MS, MOTION_DIALOG_OUT_MS, prefersReducedMotion } from '@utils/motion'
import * as React from 'react'
import { useId } from 'react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function useModal({ open, onOpenChange }: ModalProps) {
  const [labelId, setLabelId] = React.useState<string>()
  const [descriptionId, setDescriptionId] = React.useState<string>()

  const { refs, context } = useFloating({
    open,
    onOpenChange
  })

  const dismiss = useDismiss(context, { outsidePressEvent: 'mousedown' })
  const role = useRole(context)
  const interactions = useInteractions([dismiss, role])

  return React.useMemo(
    () => ({
      open,
      setOpen: onOpenChange,
      refs,
      context,
      labelId,
      descriptionId,
      setLabelId,
      setDescriptionId,
      ...interactions
    }),
    [open, onOpenChange, refs, context, interactions, labelId, descriptionId]
  )
}

type ModalContextType = ReturnType<typeof useModal> | null

const ModalContext = React.createContext<ModalContextType>(null)

const useModalContext = () => {
  const context = React.useContext(ModalContext)
  if (!context) {
    throw new Error('Modal components must be wrapped in <Modal />')
  }
  return context
}

export function Modal({
  children,
  open,
  onOpenChange
}: {
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const modal = useModal({ open, onOpenChange })
  return <ModalContext.Provider value={modal}>{children}</ModalContext.Provider>
}

type Props = {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
  align?: 'center' | 'top'
  className?: string
  children: React.ReactNode
} & Omit<React.HTMLProps<HTMLDivElement>, 'size'>

export function ModalHeading({
  children,
  className = '',
  id: idProp
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  const { setLabelId } = useModalContext()
  const generatedId = useId()
  const id = idProp ?? generatedId

  React.useLayoutEffect(() => {
    setLabelId(id)
    return () => setLabelId(undefined)
  }, [id, setLabelId])

  return (
    <h2 id={id} className={className}>
      {children}
    </h2>
  )
}

export function ModalDescription({
  children,
  className = '',
  id: idProp
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  const { setDescriptionId } = useModalContext()
  const generatedId = useId()
  const id = idProp ?? generatedId

  React.useLayoutEffect(() => {
    setDescriptionId(id)
    return () => setDescriptionId(undefined)
  }, [id, setDescriptionId])

  return (
    <p id={id} className={className}>
      {children}
    </p>
  )
}

/**
 * Dialog scrim: black-based `--modal-scrim` (globals.scss) + frosted blur.
 */
export const modalBackdropClassName = 'bg-[var(--modal-scrim)] motion-safe:backdrop-blur-sm'

export const modalBackdropHeavyClassName =
  'bg-[var(--modal-scrim-heavy)] motion-safe:backdrop-blur-sm'

export const modalPanelChromeClassName =
  'rounded-xl border border-base-300 bg-base-100 shadow-xl outline-none'

export const modalPanelClassName = `flex max-h-[90vh] flex-col overflow-hidden ${modalPanelChromeClassName}`

export const ModalContent = function ModalContent({
  size = 'md',
  align = 'center',
  className = '',
  children,
  ...restProps
}: Props) {
  const sizeClasses: Record<typeof size, string> = {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-xl',
    '2xl': 'w-full max-w-2xl',
    '3xl': 'w-full max-w-3xl',
    '4xl': 'w-full max-w-4xl',
    '5xl': 'w-full max-w-5xl',
    full: 'w-full max-w-[calc(100vw-2rem)] h-full max-h-[calc(100vh-2rem)]'
  }
  const { refs, context, labelId, descriptionId, getFloatingProps } = useModalContext()
  const ref = useMergeRefs([refs.setFloating]) as React.Ref<HTMLDivElement>

  const reduced = prefersReducedMotion()
  const { isMounted, styles: backdropStyles } = useTransitionStyles(context, {
    duration: reduced ? 0 : { open: MOTION_DIALOG_OUT_MS, close: MOTION_DIALOG_OUT_MS },
    initial: { opacity: 0 },
    common: { transitionTimingFunction: 'ease-out' },
    close: { opacity: 0, transitionTimingFunction: 'ease-in' }
  })
  const { styles: cardStyles } = useTransitionStyles(context, {
    duration: reduced ? 0 : { open: MOTION_DIALOG_IN_MS, close: MOTION_DIALOG_OUT_MS },
    initial: { opacity: 0, transform: 'scale(0.96)' },
    common: { transitionTimingFunction: 'ease-out' },
    close: { opacity: 0, transitionTimingFunction: 'ease-in' }
  })

  if (!isMounted) return null

  const {
    ref: _ref,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...safeProps
  } = restProps as {
    ref?: unknown
    'aria-label'?: string
    'aria-labelledby'?: string
    'aria-describedby'?: string
    [key: string]: unknown
  }

  const labelledBy = ariaLabelledBy ?? labelId
  const describedBy = ariaDescribedBy ?? descriptionId

  return (
    <FloatingPortal>
      <FloatingOverlay
        className={`fixed inset-0 z-50 ${modalBackdropClassName}`}
        style={backdropStyles}
        lockScroll>
        <div
          className={`fixed inset-0 flex justify-center p-4 ${
            align === 'top'
              ? 'items-start pt-[max(env(safe-area-inset-top,1rem),1rem)]'
              : 'items-center'
          }`}>
          <FloatingFocusManager context={context}>
            <div
              ref={ref}
              style={cardStyles}
              className={`${sizeClasses[size]} ${modalPanelClassName} ${className}`}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabel ? undefined : labelledBy}
              aria-describedby={describedBy}
              {...getFloatingProps(safeProps)}>
              {children}
            </div>
          </FloatingFocusManager>
        </div>
      </FloatingOverlay>
    </FloatingPortal>
  )
}
