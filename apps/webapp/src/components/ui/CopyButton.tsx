import { Tooltip } from '@components/ui/Tooltip'
import useCopyToClipboard, { UseCopyToClipboardOptions } from '@hooks/useCopyToClipboard'
import { Icons } from '@icons'
import { forwardRef, useCallback } from 'react'
import { IconType } from 'react-icons'
import { twMerge } from 'tailwind-merge'

export type CopyButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export type CopyButtonVariant = 'ghost' | 'outline' | 'soft' | 'primary'

export interface CopyButtonProps extends UseCopyToClipboardOptions {
  /** The text to copy to clipboard */
  text: string
  /** Button size */
  size?: CopyButtonSize
  /** Overrides the size→glyph map (`sm` is 16). Docked pad controls pass 20. */
  iconSize?: number
  /** Button variant */
  variant?: CopyButtonVariant
  /** Custom icon to show (default: LuCopy) */
  icon?: IconType
  /** Custom success icon (default: LuCheck) */
  successIcon?: IconType
  /** Show label text alongside icon */
  label?: string
  /** Show success label text when copied */
  successLabel?: string
  /** Additional CSS classes */
  className?: string
  /** Tooltip text */
  tooltip?: string
  /** Whether to use circle shape (icon-only button) */
  circle?: boolean
  /** Whether to use square shape (icon-only button in toolbars) */
  square?: boolean
  /** Callback when copy button is clicked (receives the text) */
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

    const button = (
      <button
        ref={ref}
        type="button"
        aria-label={tooltip || (typeof currentLabel === 'string' && currentLabel) || 'Copy'}
        onClick={handleClick}
        disabled={copying}
        className={twMerge(
          'btn relative',
          btnSize,
          variantConfig[variant],
          circle && 'btn-circle',
          square && 'btn-square',
          showLabel && gap,
          className
        )}>
        <span className="relative inline-flex items-center justify-center">
          <Icon
            size={resolvedIconSize}
            className={twMerge(
              'stroke-[1.75] transition-all duration-200',
              copied ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
            )}
          />
          <SuccessIcon
            size={resolvedIconSize}
            className={twMerge(
              'text-success absolute stroke-[1.75] transition-all duration-200',
              copied ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
            )}
          />
        </span>

        {showLabel && (
          <span className={twMerge('transition-colors duration-200', copied && 'text-success')}>
            {currentLabel}
          </span>
        )}
      </button>
    )

    if (!tooltip) return button

    return <Tooltip title={tooltip}>{button}</Tooltip>
  }
)

CopyButton.displayName = 'CopyButton'

export default CopyButton
