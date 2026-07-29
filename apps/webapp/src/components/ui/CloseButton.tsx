import { Icons } from '@icons'

import Button from './Button'

export type CloseButtonSize = 'xs' | 'sm' | 'md'

interface CloseButtonProps {
  onClick: () => void
  size?: CloseButtonSize
  className?: string
  'aria-label'?: string
}

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
      startIcon={Icons.close}
      className={`text-base-content/50 hover:text-base-content ${className}`}
      aria-label={ariaLabel}
    />
  )
}

CloseButton.displayName = 'CloseButton'

export default CloseButton
