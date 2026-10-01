import Button, { type ButtonProps } from '@components/ui/Button'
import { useTouchPress } from '@hooks/useTouchPress'
import type { Editor } from '@tiptap/core'
import { twMerge } from '@utils/twMerge'
import React from 'react'

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
      'aria-label': ariaLabel,
      tooltip,
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
        aria-label={ariaLabel ?? tooltip}
        tooltip={tooltip}
        className={twMerge(
          // daisyUI's ghost rest hook, not a text utility: hover, pressed and focus keep
          // daisyUI's ink. Active skips it; `is-active` has no ink outside `_toolbar.scss`.
          variant === 'ghost' &&
            !active &&
            '[--btn-rest-fg:color-mix(in_oklab,var(--color-base-content)_70%,transparent)]',
          // daisyUI's disabled ink is /20; the house disabled step is /40.
          'focus-visible:ring-primary disabled:text-base-content/40 focus-visible:ring-2 focus-visible:outline-none',
          active && 'is-active',
          className
        )}
        onClick={onPress ? handleClick : onClick}
        onTouchEnd={onPress ? handleTouchEnd : onTouchEnd}
        {...rest}
      />
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
