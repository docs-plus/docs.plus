import Button, { type ButtonProps } from '@components/ui/Button'
import { useTouchPress } from '@hooks/useTouchPress'
import type { Editor } from '@tiptap/core'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ToolbarButtonProps extends Omit<ButtonProps, 'type' | 'shape'> {
  type?: string
  editor?: Editor | null
  isActive?: boolean
  /** Fires once for taps and clicks so the button stays VoiceOver-activatable — see `useTouchPress`. */
  onPress?: (event: React.MouseEvent | React.TouchEvent) => void
  /** Pass `null` to opt out of the default `square` shape */
  shape?: ButtonProps['shape'] | null
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      type,
      editor,
      isActive,
      onPress,
      onClick,
      onTouchEnd,
      className,
      variant = 'ghost',
      size = 'sm',
      shape = 'square',
      ...rest
    },
    ref
  ) => {
    const active = isActive ?? (type ? editor?.isActive(type) : false)
    const { handleTouchEnd, handleClick } = useTouchPress(onPress, onClick)

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        shape={shape || undefined}
        className={twMerge(active ? 'is-active' : '', className)}
        onClick={onPress ? handleClick : onClick}
        onTouchEnd={onPress ? handleTouchEnd : onTouchEnd}
        {...rest}
      />
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
