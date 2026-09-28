import { Tooltip } from '@components/ui/Tooltip'
import useCopyToClipboard, { UseCopyToClipboardOptions } from '@hooks/useCopyToClipboard'
import { Icons } from '@icons'
import { forwardRef, useCallback } from 'react'
import { IconType } from 'react-icons'
import { twMerge } from 'tailwind-merge'

export type CopyButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export type CopyButtonVariant = 'ghost' | 'outline' | 'soft' | 'primary'

export interface CopyButtonProps extends UseCopyToClipboardOptions {
  text: string
  size?: CopyButtonSize
  /** Overrides the size→glyph map (`sm` is 16). Docked pad controls pass 20. */
  iconSize?: number
  variant?: CopyButtonVariant
  icon?: IconType
  successIcon?: IconType
  label?: string
  successLabel?: string
  className?: string
  tooltip?: string
  circle?: boolean
  square?: boolean
  onClick?: (text: string) => void
}

const sizeConfig = {
  xs: { btn: 'btn-xs', icon: 14, gap: 'gap-1' },
  sm: { btn: 'btn-sm', icon: 16, gap: 'gap-1.5' },
  md: { btn: '', icon: 18, gap: 'gap-2' },
  lg: { btn: 'btn-lg', icon: 20, gap: 'gap-2' }
}

const variantConfig = {
  ghost: 'btn-ghost',
  outline: 'btn-outline',
  soft: 'btn-soft btn-neutral',
  primary: 'btn-primary'
}

const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      text,
      size = 'sm',
      iconSize,
      variant = 'ghost',
      icon: Icon = Icons.copy,
      successIcon: SuccessIcon = Icons.check,
      label,
      successLabel = 'Copied!',
      className,
      tooltip,
      circle = false,
      square = false,
      onClick,
      resetDelay,
      successMessage,
      errorMessage,
      onSuccess,
      onError
    },
    ref
  ) => {
    const { copy, copied, copying } = useCopyToClipboard({
      resetDelay,
      successMessage,
      errorMessage,
      onSuccess,
      onError
    })

    const handleClick = useCallback(() => {
      copy(text)
      onClick?.(text)
    }, [copy, text, onClick])

    const { btn: btnSize, icon: defaultIconSize, gap } = sizeConfig[size]
    const resolvedIconSize = iconSize ?? defaultIconSize

    // Icon-only shapes (square/circle) never show labels — only icon animation
    const isIconOnly = square || circle
    const showLabel = !isIconOnly && (label || (copied && successLabel))
    const currentLabel = copied ? successLabel : label

    const isPrimarySuccess = variant === 'primary' && copied
    const successInk = isPrimarySuccess ? undefined : 'text-success'

    const idleLabel = tooltip || currentLabel || 'Copy'
    const doneLabel = successLabel

    const button = (
      <button
        ref={ref}
        type="button"
        aria-label={copied ? doneLabel : idleLabel}
        onClick={handleClick}
        disabled={copying}
        className={twMerge(
          'btn relative',
          btnSize,
          // Green ink on a primary fill is unreadable, so the fill turns green instead.
          isPrimarySuccess ? 'btn-success' : variantConfig[variant],
          circle && 'btn-circle',
          square && 'btn-square',
          showLabel && gap,
          className
        )}>
        <span className={`swap ${copied ? 'swap-active' : ''}`} aria-hidden>
          <SuccessIcon
            size={resolvedIconSize}
            className={twMerge('swap-on stroke-[1.75]', successInk)}
          />
          <Icon size={resolvedIconSize} className="swap-off stroke-[1.75]" />
        </span>

        {showLabel && (
          <span
            className={twMerge(
              'motion-safe:transition-colors motion-safe:duration-[var(--motion-panel)]',
              copied && successInk
            )}>
            {currentLabel}
          </span>
        )}
      </button>
    )

    if (!tooltip) return button

    return <Tooltip title={copied ? doneLabel : tooltip}>{button}</Tooltip>
  }
)

CopyButton.displayName = 'CopyButton'

export default CopyButton
