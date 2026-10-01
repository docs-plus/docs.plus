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
import { twMerge } from '@utils/twMerge'
import * as React from 'react'
import { useId } from 'react'

import CloseButton from './CloseButton'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ModalRole = 'dialog' | 'alertdialog'

function useModal({ open, onOpenChange }: ModalProps) {
  const [labelId, setLabelId] = React.useState<string>()
  const [descriptionId, setDescriptionId] = React.useState<string>()
  const [modalRole, setModalRole] = React.useState<ModalRole>('dialog')

  const { refs, context } = useFloating({
    open,
    onOpenChange
  })

  const dismiss = useDismiss(context, { outsidePressEvent: 'mousedown' })
  const role = useRole(context, { role: modalRole })
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
      setModalRole,
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

export type ModalAlign = 'center' | 'top'

/** Width ladder: confirm `sm`, form `md`/`lg`, rich content `2xl`. Settings hub uses `4xl`/`5xl`. */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'

type Props = {
  size?: ModalSize
  align?: ModalAlign
  mobileTakeover?: boolean
  className?: string
  children: React.ReactNode
} & Omit<React.HTMLProps<HTMLDivElement>, 'size'>

function overlayAlignClass(align: ModalAlign, mobileTakeover: boolean): string {
  const takeoverPad = mobileTakeover ? 'max-md:p-0' : ''
  switch (align) {
    case 'top':
      return twMerge('items-start p-4 pt-[max(env(safe-area-inset-top,1rem),1rem)]', takeoverPad)
    case 'center':
      return twMerge('items-center p-4', takeoverPad)
    default: {
      const _exhaustive: never = align
      return _exhaustive
    }
  }
}

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
    <h2
      id={id}
      className={twMerge('text-base-content text-xl font-semibold text-balance', className)}>
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
    <p id={id} className={twMerge('text-base-content/70 text-sm', className)}>
      {children}
    </p>
  )
}

/** Card role for the open modal. A confirm passes `alertdialog`; unmount restores `dialog`,
 *  because GlobalDialog reuses one Modal for every body. */
export function useModalRole(role: ModalRole) {
  const { setModalRole } = useModalContext()

  React.useLayoutEffect(() => {
    setModalRole(role)
    return () => setModalRole('dialog')
  }, [role, setModalRole])
}

/** Dialog body. `relative` anchors `ModalClose`. */
export function ModalBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('relative flex flex-col gap-4 p-6', className)} {...props} />
}

/** Dialog action row: Cancel first, the one primary last. `mt-2` on the `gap-4` body gives 24px. */
export function DialogActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge('mt-2 flex flex-wrap justify-end gap-2', className)} {...props} />
}

/** Top-right close for a `ModalBody`; give the title `pr-10` so it clears the button. */
export function ModalClose({
  className,
  'aria-label': ariaLabel = 'Close'
}: {
  className?: string
  'aria-label'?: string
}) {
  const { setOpen } = useModalContext()
  return (
    <CloseButton
      size="md"
      onClick={() => setOpen(false)}
      aria-label={ariaLabel}
      className={twMerge('absolute top-[18px] right-4', className)}
    />
  )
}

/**
 * Dialog scrim: black-based `--modal-scrim` (globals.scss) + frosted blur.
 */
export const modalBackdropClassName = 'bg-[var(--modal-scrim)] motion-safe:backdrop-blur-sm'

export const modalBackdropHeavyClassName =
  'bg-[var(--modal-scrim-heavy)] motion-safe:backdrop-blur-sm'

export const modalPanelFrameClassName =
  'rounded-box border border-base-300 bg-base-100 shadow-xl outline-none'

/* overflow-clip, not -hidden: browsers scroll-into-view can silently scroll a hidden
   clip box when focusing off-screen children; clip forbids programmatic scrolling. */
export const modalPanelClassName = `flex max-h-[90vh] flex-col overflow-clip ${modalPanelFrameClassName}`

/**
 * Mobile takeover arm (design-system.md §Elevation). Below `md` the dialog card fills
 * the visual viewport with no card frame. The `100dvh` fallback covers an unsynced vv var.
 */
export const modalPanelTakeoverClassName =
  'max-md:h-[var(--visual-viewport-height,100dvh)] max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:shadow-none max-md:pt-[env(safe-area-inset-top,0px)]'

export const ModalContent = function ModalContent({
  size = 'md',
  align = 'center',
  mobileTakeover = false,
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
          className={twMerge(
            'fixed inset-0 flex justify-center',
            overlayAlignClass(align, mobileTakeover)
          )}>
          <FloatingFocusManager context={context}>
            <div
              ref={ref}
              style={cardStyles}
              className={twMerge(
                sizeClasses[size],
                modalPanelClassName,
                mobileTakeover && modalPanelTakeoverClassName,
                className
              )}
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
