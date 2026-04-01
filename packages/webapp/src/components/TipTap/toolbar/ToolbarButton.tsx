import Button, { type ButtonProps } from '@components/ui/Button'
import type { Editor } from '@tiptap/core'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ToolbarButtonProps extends Omit<ButtonProps, 'type' | 'shape'> {
  type?: string
  editor?: Editor | null
  isActive?: boolean
  /** Pass `null` to opt out of the default `square` shape */
  shape?: ButtonProps['shape'] | null
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      type,
      editor,
      isActive,
      className,
      variant = 'ghost',
      size = 'sm',
      shape = 'square',
      ...rest
    },
    ref
  ) => {
    const active = isActive ?? (type ? editor?.isActive(type) : false)

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        shape={shape || undefined}
        className={twMerge(active ? 'is-active' : '', className)}
        {...rest}
      />
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
