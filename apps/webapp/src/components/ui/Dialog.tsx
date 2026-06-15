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

export const ModalContent = function ModalContent({
  size = 'md',
  align = 'center',
  className = '',
  children,
  ...restProps
}: Props) {
  const sizeClasses: Record<typeof size, string> = {
    sm: 'w-full max-w-sm', // 384px
    md: 'w-full max-w-md', // 448px
    lg: 'w-full max-w-lg', // 512px
    xl: 'w-full max-w-xl', // 576px
    '2xl': 'w-full max-w-2xl', // 672px
    '3xl': 'w-full max-w-3xl', // 768px
    '4xl': 'w-full max-w-4xl', // 896px
    '5xl': 'w-full max-w-5xl', // 1024px
    full: 'w-full max-w-[calc(100vw-2rem)] h-full max-h-[calc(100vh-2rem)]'
  }
  const { refs, context, getFloatingProps } = useModalContext()
  const ref = useMergeRefs([refs.setFloating]) as React.Ref<HTMLDivElement>
  const id = useId()

  // Dialog tier: backdrop 150ms fade, card 180ms ease-out scale from center,
  // exits 150ms. JS-gated for reduced motion (inline styles beat CSS PRM rules).
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

  // Extract only the props we need to pass to getFloatingProps (excluding ref/children)
  const { ref: _ref, ...safeProps } = restProps as { ref?: unknown; [key: string]: unknown }

  return (
    <FloatingPortal>
      <FloatingOverlay
        className="bg-base-content/40 fixed inset-0 z-50 backdrop-blur-sm"
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
              className={`outline-none ${sizeClasses[size]} rounded-box border-base-300 bg-base-100 flex max-h-[90vh] flex-col overflow-hidden border shadow-xl ${className}`}
              aria-labelledby={id}
              aria-describedby={id}
              id={id}
              {...getFloatingProps(safeProps)}>
              {children}
            </div>
          </FloatingFocusManager>
        </div>
      </FloatingOverlay>
    </FloatingPortal>
  )
}
