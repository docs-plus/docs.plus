import { forwardRef, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { MdContentCopy, MdCheck } from 'react-icons/md'
import { IconType } from 'react-icons'
import useCopyToClipboard, { UseCopyToClipboardOptions } from '@hooks/useCopyToClipboard'

export type CopyButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export type CopyButtonVariant = 'ghost' | 'outline' | 'soft' | 'primary'

export interface CopyButtonProps extends UseCopyToClipboardOptions {
  /** The text to copy to clipboard */
  text: string
  /** Button size */
  size?: CopyButtonSize
  /** Button variant */
  variant?: CopyButtonVariant
  /** Custom icon to show (default: MdContentCopy) */
  icon?: IconType
  /** Custom success icon (default: MdCheck) */
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

/**
 * CopyButton - A button that copies text to clipboard with animated feedback.
 *
 * Features:
 * - GitHub-style icon animation (copy → checkmark)
 * - Configurable toast notifications
 * - Multiple sizes and variants
 * - Optional label text
 *
 * @example
 * // Basic icon-only button
 * <CopyButton text={url} tooltip="Copy link" />
 *
 * @example
 * // With label
 * <CopyButton text={code} label="Copy" successLabel="Copied!" />
 *
 * @example
 * // Without toast (inline feedback only)
 * <CopyButton text={url} successMessage={null} />
 *
 * @example
 * // Custom success message
 * <CopyButton text={url} successMessage="Link copied!" />
 */
const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      text,
      size = 'sm',
      variant = 'ghost',
      icon: Icon = MdContentCopy,
      successIcon: SuccessIcon = MdCheck,
      label,
      successLabel = 'Copied!',
      className,
      tooltip,
      circle = false,
      onClick,
      // Hook options
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

    const { btn: btnSize, icon: iconSize, gap } = sizeConfig[size]

    // Determine if we're showing a label
    const showLabel = label || (copied && successLabel)
    const currentLabel = copied ? successLabel : label

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={copying}
        className={twMerge(
          'btn relative',
          btnSize,
          variantConfig[variant],
          circle && 'btn-circle',
          showLabel && gap,
          className
        )}
        title={tooltip}
        data-tip={tooltip}>
        {/* Icon container with animation */}
        <span className="relative inline-flex items-center justify-center">
          {/* Copy icon - fades out when copied */}
          <Icon
            size={iconSize}
            className={twMerge(
              'transition-all duration-200',
              copied ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
            )}
          />
          {/* Success icon - fades in when copied */}
          <SuccessIcon
            size={iconSize}
            className={twMerge(
              'text-success absolute transition-all duration-200',
              copied ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
            )}
          />
        </span>

        {/* Label text */}
        {showLabel && (
          <span className={twMerge('transition-colors duration-200', copied && 'text-success')}>
            {currentLabel}
          </span>
        )}
      </button>
    )
  }
)

CopyButton.displayName = 'CopyButton'

export default CopyButton
