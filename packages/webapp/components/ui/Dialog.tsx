import * as React from 'react'
import {
  useFloating,
  useDismiss,
  useRole,
  useInteractions,
  useMergeRefs,
  FloatingPortal,
  FloatingFocusManager,
  FloatingOverlay
} from '@floating-ui/react'
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
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  children: React.ReactNode
} & Omit<React.HTMLProps<HTMLDivElement>, 'size'>

export const ModalContent = function ModalContent({
  size = 'md',
  className = '',
  ...props
}: Props) {
  const sizeClasses: Record<typeof size, string> = {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-xl',
    full: 'w-full max-w-[calc(100vw-2rem)] h-full max-h-[calc(100vh-2rem)]'
  }
  const { open, refs, context, getFloatingProps } = useModalContext()
  const ref = useMergeRefs([refs.setFloating])
  const id = useId()

  if (!open) return null

  return (
    <FloatingPortal>
      <FloatingOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" lockScroll>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <FloatingFocusManager context={context}>
            <div
              ref={ref}
              className={`animate-in fade-in-0 zoom-in-95 ${sizeClasses[size]} max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl duration-200 ${className}`}
              aria-labelledby={id}
              aria-describedby={id}
              id={id}
              {...getFloatingProps(props)}>
              {props.children}
            </div>
          </FloatingFocusManager>
        </div>
      </FloatingOverlay>
    </FloatingPortal>
  )
}
