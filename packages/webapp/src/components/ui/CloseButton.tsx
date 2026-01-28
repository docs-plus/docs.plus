import { MdClose } from 'react-icons/md'
import Button from './Button'

export type CloseButtonSize = 'xs' | 'sm' | 'md'

interface CloseButtonProps {
  onClick: () => void
  size?: CloseButtonSize
  className?: string
  'aria-label'?: string
}

/**
 * A consistent close button component for dialogs, popovers, and panels.
 * Uses the shared Button component with daisyUI styling.
 *
 * @example
 * // Standard usage in dialog header
 * <CloseButton onClick={handleClose} />
 *
 * // Smaller variant for inline contexts
 * <CloseButton onClick={handleClose} size="xs" />
 *
 * // With custom aria-label
 * <CloseButton onClick={handleClose} aria-label="Dismiss notification" />
 */
const CloseButton = ({
  onClick,
  size = 'sm',
  className = '',
  'aria-label': ariaLabel = 'Close'
}: CloseButtonProps) => {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size={size}
      shape="circle"
      startIcon={MdClose}
      className={`text-base-content/50 hover:text-base-content ${className}`}
      aria-label={ariaLabel}
    />
  )
}

CloseButton.displayName = 'CloseButton'

export default CloseButton
