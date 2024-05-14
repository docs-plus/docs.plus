import React, { forwardRef, LabelHTMLAttributes } from 'react'

type CheckboxModalProps = {
  id: string
  children?: React.ReactNode
}
// Extend the props with React.LabelHTMLAttributes to accept any valid label attributes
export const ModalTrigger = forwardRef<
  HTMLLabelElement,
  CheckboxModalProps & LabelHTMLAttributes<HTMLLabelElement>
>(({ id, children, ...restProps }, ref) => {
  return (
    <label ref={ref} htmlFor={id} {...restProps}>
      {children}
    </label>
  )
})

ModalTrigger.displayName = 'ModalTrigger'
